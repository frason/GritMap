import CryptoKit
import Foundation

/// The pure serving logic of the BLE direct transfer (docs/BLE_DIRECT_TRANSFER_CONTRACT.md), with no
/// Bluetooth or Expo dependency so it can be unit-tested on a Mac (scripts/test-transfer-session.swift).
/// One instance is one transfer: it holds the manifest and the resource bytes, answers reads and
/// writes by central, and forgets everything on `end()`. It never logs and never exposes the bytes
/// through events.
final class TransferSession {
  enum Outcome<T> {
    case ok(T)
    /// The request must be refused with an ATT error: another central owns the session, the session
    /// has ended, or the request is malformed.
    case refused
    /// A read whose value offset is past the end of the value (ATT "invalid offset").
    case invalidOffset
  }

  enum Event: Equatable {
    case manifestRead
    case progress(resource: String, served: Int, total: Int)
    case receipt(status: String, code: String)
  }

  static let resourceNames = ["plan", "segment", "rider"]
  static let maxRequestBytes = 64
  static let maxStatusBytes = 128
  /// The session ends after this long without any owner request or read.
  static let inactivitySeconds: TimeInterval = 30
  /// Once the plan has been fully read, the Karoo gets this long to write its receipt.
  static let receiptWindowSeconds: TimeInterval = 60

  let transferId: String
  let chunkBytes: Int
  private var manifest: Data?
  private var resources: [String: Data]
  private var owner: String?
  private var last: (resource: String, offset: Int)?
  /// True once the current request's chunk has been (at least partly) read.
  private var readSinceRequest = false
  private var served: [String: Int] = [:]
  private var receiptSeen = false
  private(set) var ended = false

  /// `manifest` is the exact serialised manifest; `resources` the exact bytes keyed "plan", "segment", "rider".
  init(transferId: String, manifest: Data, resources: [String: Data], chunkBytes: Int = 512) {
    self.transferId = transferId
    self.manifest = manifest
    self.resources = resources
    self.chunkBytes = max(20, min(chunkBytes, 512))
  }

  private func claim(_ central: String) -> Bool {
    if ended { return false }
    if owner == nil { owner = central }
    return owner == central
  }

  /// A read of the Manifest characteristic at ATT value offset `valueOffset` (long reads arrive in parts).
  func readManifest(central: String, valueOffset: Int = 0, emit: (Event) -> Void) -> Outcome<Data> {
    guard claim(central), let manifest = manifest else { return .refused }
    guard valueOffset >= 0, valueOffset <= manifest.count else { return .invalidOffset }
    emit(.manifestRead)
    return .ok(valueOffset == 0 ? manifest : manifest.subdata(in: valueOffset..<manifest.count))
  }

  /// Records that `resource` has been delivered up to `end`, emitting progress when that is new.
  private func markServed(_ resource: String, end: Int, emit: (Event) -> Void) {
    guard let total = resources[resource]?.count else { return }
    let previous = served[resource] ?? 0
    guard end > previous else { return }
    served[resource] = end
    emit(.progress(resource: resource, served: end, total: total))
  }

  /// The chunk of the current request, when the Karoo has read it and then moved on (a new Request or the
  /// receipt), is complete: a Karoo checks the exact chunk length before it asks for the next one.
  private func settleLastChunk(emit: (Event) -> Void) {
    guard readSinceRequest, let request = last, let data = resources[request.resource] else { return }
    markServed(request.resource, end: min(request.offset + chunkBytes, data.count), emit: emit)
  }

  /// A write to the Request characteristic: `{"resource":"plan","offset":N}`.
  func writeRequest(central: String, body: Data, emit: (Event) -> Void = { _ in }) -> Outcome<Void> {
    guard claim(central), body.count <= TransferSession.maxRequestBytes,
          let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
          object.count == 2,
          let resource = object["resource"] as? String,
          let offsetNumber = object["offset"] as? NSNumber,
          CFGetTypeID(offsetNumber) != CFBooleanGetTypeID(),
          let data = resources[resource] else { return .refused }
    let offset = offsetNumber.intValue
    guard offsetNumber.doubleValue == Double(offset), offset >= 0, offset < data.count else { return .refused }
    settleLastChunk(emit: emit)
    last = (resource, offset)
    readSinceRequest = false
    return .ok(())
  }

  /// A read of the Data characteristic at ATT value offset `valueOffset` (for long reads).
  /// `maxResponseBytes` is how many bytes one ATT response can carry (MTU - 1); CoreBluetooth truncates a
  /// longer value, and the rest arrives by further reads. A chunk counts as served only once its last
  /// byte has been delivered (this read reached the end of the chunk), or the Karoo has moved on.
  func readData(central: String, valueOffset: Int, maxResponseBytes: Int = Int.max, emit: (Event) -> Void) -> Outcome<Data> {
    guard claim(central), let request = last, let data = resources[request.resource] else { return .refused }
    let end = min(request.offset + chunkBytes, data.count)
    let chunk = data.subdata(in: request.offset..<end)
    guard valueOffset >= 0, valueOffset <= chunk.count else { return .invalidOffset }
    let part = chunk.subdata(in: valueOffset..<chunk.count)
    readSinceRequest = true
    let delivered = min(part.count, max(0, maxResponseBytes))
    if valueOffset + delivered >= chunk.count {
      markServed(request.resource, end: end, emit: emit)
    }
    return .ok(part)
  }

  /// A write to the Status characteristic: the receipt. Accepted once, from the owner, for this transfer id.
  func writeStatus(central: String, body: Data, emit: (Event) -> Void) -> Outcome<Void> {
    guard claim(central), !receiptSeen, body.count <= TransferSession.maxStatusBytes,
          let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
          object.count == 3,
          object["transferId"] as? String == transferId,
          let status = object["status"] as? String, status == "imported" || status == "rejected",
          let code = object["code"] as? String,
          code.range(of: "^[a-z0-9_]{1,32}$", options: .regularExpression) != nil else { return .refused }
    receiptSeen = true
    settleLastChunk(emit: emit)
    emit(.receipt(status: status, code: code))
    return .ok(())
  }

  /// True when the plan has been read through to its last byte.
  func planFullyServed() -> Bool {
    guard let plan = resources["plan"] else { return false }
    return (served["plan"] ?? 0) >= plan.count
  }

  /// How long the session may sit idle before it ends: 30 s while the Karoo is still reading, 60 s once the
  /// plan is fully served (the Karoo is importing and will write the receipt).
  func idleLimitSeconds() -> TimeInterval {
    planFullyServed() ? TransferSession.receiptWindowSeconds : TransferSession.inactivitySeconds
  }

  /// The state to report when the session runs out of time: "sentUnconfirmed" if the plan was fully read,
  /// otherwise "timedOut".
  func idleOutcome() -> String {
    planFullyServed() ? "sentUnconfirmed" : "timedOut"
  }

  /// Checks that the manifest's declared byte counts and SHA-256 digests match the bytes about to be served,
  /// so a builder bug is caught on the phone and not reported by the Karoo as `bad_hash`. Returns nil when
  /// consistent, otherwise a short reason (never any content).
  static func manifestMismatch(manifest: Data, resources: [String: Data]) -> String? {
    guard let object = try? JSONSerialization.jsonObject(with: manifest) as? [String: Any] else { return "manifest is not a JSON object" }
    for name in resourceNames {
      let declared = object[name] as? [String: Any]
      let bytes = resources[name]
      switch (declared, bytes) {
      case (nil, nil):
        continue
      case (nil, _?):
        return "\(name) bytes were given but the manifest does not list it"
      case (_?, nil):
        return "the manifest lists \(name) but no bytes were given"
      case (let declared?, let bytes?):
        guard let count = declared["bytes"] as? Int, count == bytes.count else { return "\(name) byte length does not match the manifest" }
        let digest = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        guard declared["sha256"] as? String == digest else { return "\(name) SHA-256 does not match the manifest" }
      }
    }
    return nil
  }

  func end() {
    ended = true
    manifest = nil
    resources = [:]
    owner = nil
    last = nil
    readSinceRequest = false
  }
}
