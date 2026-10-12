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
  }

  enum Event: Equatable {
    case manifestRead
    case progress(resource: String, served: Int, total: Int)
    case receipt(status: String, code: String)
  }

  static let resourceNames = ["plan", "segment", "rider"]
  static let maxRequestBytes = 64
  static let maxStatusBytes = 128

  let transferId: String
  let chunkBytes: Int
  private var manifest: Data?
  private var resources: [String: Data]
  private var owner: String?
  private var last: (resource: String, offset: Int)?
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

  func readManifest(central: String, emit: (Event) -> Void) -> Outcome<Data> {
    guard claim(central), let manifest = manifest else { return .refused }
    emit(.manifestRead)
    return .ok(manifest)
  }

  /// A write to the Request characteristic: `{"resource":"plan","offset":N}`.
  func writeRequest(central: String, body: Data) -> Outcome<Void> {
    guard claim(central), body.count <= TransferSession.maxRequestBytes,
          let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
          object.count == 2,
          let resource = object["resource"] as? String,
          let offsetNumber = object["offset"] as? NSNumber,
          CFGetTypeID(offsetNumber) != CFBooleanGetTypeID(),
          let data = resources[resource] else { return .refused }
    let offset = offsetNumber.intValue
    guard offsetNumber.doubleValue == Double(offset), offset >= 0, offset < data.count else { return .refused }
    last = (resource, offset)
    return .ok(())
  }

  /// A read of the Data characteristic at ATT value offset `valueOffset` (for long reads).
  func readData(central: String, valueOffset: Int, emit: (Event) -> Void) -> Outcome<Data> {
    guard claim(central), let request = last, let data = resources[request.resource] else { return .refused }
    let end = min(request.offset + chunkBytes, data.count)
    let chunk = data.subdata(in: request.offset..<end)
    guard valueOffset >= 0, valueOffset <= chunk.count else { return .refused }
    let part = chunk.subdata(in: valueOffset..<chunk.count)
    if valueOffset + part.count == chunk.count {
      let reached = max(served[request.resource] ?? 0, end)
      served[request.resource] = reached
      emit(.progress(resource: request.resource, served: reached, total: data.count))
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
    emit(.receipt(status: status, code: code))
    return .ok(())
  }

  /// True when the plan has been read through to its last byte.
  func planFullyServed() -> Bool {
    guard let plan = resources["plan"] else { return false }
    return (served["plan"] ?? 0) >= plan.count
  }

  func end() {
    ended = true
    manifest = nil
    resources = [:]
    owner = nil
    last = nil
  }
}
