import CryptoKit
import Foundation

/// One complete, frozen-ready offer: the exact manifest and the exact resource bytes it describes.
/// `requires` lists the receiver features (docs/RECEIVER_CAPABILITIES_CONTRACT.md) this offer carries
/// fields for; a baseline variant requires none and is what every old Karoo gets.
struct TransferVariant {
  let name: String
  let requires: Set<String>
  let manifest: Data
  let resources: [String: Data]
}

/// What a receiver advertises by writing the optional capabilities characteristic. Mirrors
/// `parseReceiverCapabilities` in src/transfer/receiverCapabilities.ts: anything else means baseline only.
struct ReceiverCapabilities: Equatable {
  let features: Set<String>
  let maxRecordBytes: Int

  static let maxBytes = 512

  static func parse(_ body: Data) -> ReceiverCapabilities? {
    guard body.count <= maxBytes,
          let object = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
          object.count == 6,
          let v = integer(object["v"]), v == 1,
          let transferV = integer(object["transferV"]), transferV == 2,
          let versionCode = integer(object["versionCode"]), versionCode > 0,
          let list = object["features"] as? [Any], list.count <= 16,
          let maxManifest = integer(object["maxManifestBytes"]), maxManifest == 512,
          let maxRecord = integer(object["maxRecordBytes"]), maxRecord >= 0, maxRecord <= 8192 else { return nil }
    var features = Set<String>()
    for item in list {
      guard let text = item as? String, text.range(of: "^[A-Za-z0-9]{1,40}$", options: .regularExpression) != nil,
            features.insert(text).inserted else { return nil }
    }
    if features.contains("segmentRecordV1") && maxRecord < 1 { return nil }
    return ReceiverCapabilities(features: features, maxRecordBytes: maxRecord)
  }

  /// A JSON number that is a whole number and not a boolean.
  private static func integer(_ value: Any?) -> Int? {
    guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
    let int = number.intValue
    return number.doubleValue == Double(int) ? int : nil
  }
}

/// The pure serving logic of the BLE direct transfer (docs/BLE_DIRECT_TRANSFER_CONTRACT.md), with no
/// Bluetooth or Expo dependency so it can be unit-tested on a Mac (scripts/test-transfer-session.swift).
/// One instance is one transfer: it holds one or more staged variants (a baseline every Karoo can read, and
/// richer ones for receivers that advertise the matching features), picks exactly one for the owning central,
/// freezes it, answers reads and writes by central, and forgets everything on `end()`. It never logs and never
/// exposes the bytes through events.
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
    /// The variant that was chosen for this central and is now frozen ("baseline" or a richer one).
    case variant(String)
    case progress(resource: String, served: Int, total: Int)
    case receipt(status: String, code: String)
  }

  static let resourceNames = ["plan", "segment", "rider", "record"]
  static let maxRequestBytes = 64
  static let maxStatusBytes = 128
  /// The session ends after this long without any owner request or read.
  static let inactivitySeconds: TimeInterval = 30
  /// Once the plan has been fully read, the Karoo gets this long to write its receipt.
  static let receiptWindowSeconds: TimeInterval = 60

  let transferId: String
  let chunkBytes: Int
  private var variants: [TransferVariant]
  /// The frozen choice. Set by the capabilities write, or by the first manifest read / request (baseline).
  private var selectedIndex: Int?
  /// The capabilities body that made the choice, so an identical rewrite on reconnect is a no-op.
  private var capabilityBody: Data?
  private var owner: String?
  private var last: (resource: String, offset: Int)?
  /// True once the current request's chunk has been (at least partly) read.
  private var readSinceRequest = false
  private var served: [String: Int] = [:]
  private var receiptSeen = false
  private(set) var ended = false

  /// A single baseline offer: `manifest` is the exact serialised manifest; `resources` the exact bytes keyed
  /// "plan", "segment", "rider".
  convenience init(transferId: String, manifest: Data, resources: [String: Data], chunkBytes: Int = 512) {
    self.init(transferId: transferId,
              variants: [TransferVariant(name: "baseline", requires: [], manifest: manifest, resources: resources)],
              chunkBytes: chunkBytes)
  }

  /// Several offers for the same transfer; the richest one the receiver can use is chosen, the baseline otherwise.
  init(transferId: String, variants: [TransferVariant], chunkBytes: Int = 512) {
    self.transferId = transferId
    self.variants = variants
    self.chunkBytes = max(20, min(chunkBytes, 512))
  }

  private var selected: TransferVariant? {
    guard let index = selectedIndex, index < variants.count else { return nil }
    return variants[index]
  }

  private var resources: [String: Data] { selected?.resources ?? [:] }

  /// The name of the frozen variant, once chosen.
  var selectedName: String? { selected?.name }

  private func claim(_ central: String) -> Bool {
    if ended { return false }
    if owner == nil { owner = central }
    return owner == central
  }

  /// Chooses the variant for these capabilities: among the variants whose required features were all advertised
  /// (and whose record fits the advertised record limit), the one requiring the most features; the baseline when
  /// nothing was advertised. Returns nil only when there is no usable variant at all.
  static func chooseVariant(_ variants: [TransferVariant], capabilities: ReceiverCapabilities?) -> Int? {
    var best: Int?
    for (index, variant) in variants.enumerated() {
      let usable: Bool
      if let capabilities = capabilities {
        let recordFits = (variant.resources["record"]?.count ?? 0) <= capabilities.maxRecordBytes
        usable = variant.requires.isSubset(of: capabilities.features) && recordFits
      } else {
        usable = variant.requires.isEmpty
      }
      guard usable else { continue }
      if best == nil || variant.requires.count > variants[best!].requires.count { best = index }
    }
    return best
  }

  /// Freezes the choice (once) and reports it.
  @discardableResult
  private func freeze(capabilities: ReceiverCapabilities?, emit: (Event) -> Void) -> Bool {
    if selectedIndex != nil { return true }
    guard let index = TransferSession.chooseVariant(variants, capabilities: capabilities) else { return false }
    selectedIndex = index
    emit(.variant(variants[index].name))
    return true
  }

  /// A write to the optional capabilities characteristic, before the manifest is read. The first central to write
  /// (or to read the manifest) owns the session. An identical write on reconnect changes nothing; a different one,
  /// or one after the manifest was already chosen, is refused. A malformed or unknown advertisement is accepted and
  /// means baseline only.
  func writeCapabilities(central: String, body: Data, emit: (Event) -> Void = { _ in }) -> Outcome<Void> {
    guard claim(central) else { return .refused }
    if let previous = capabilityBody { return previous == body ? .ok(()) : .refused }
    if selectedIndex != nil { return .refused }
    capabilityBody = body
    guard freeze(capabilities: ReceiverCapabilities.parse(body), emit: emit) else { return .refused }
    return .ok(())
  }

  /// A read of the Manifest characteristic at ATT value offset `valueOffset` (long reads arrive in parts).
  func readManifest(central: String, valueOffset: Int = 0, emit: (Event) -> Void) -> Outcome<Data> {
    guard claim(central), freeze(capabilities: nil, emit: emit), let manifest = selected?.manifest else { return .refused }
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
    guard claim(central), freeze(capabilities: nil, emit: emit), body.count <= TransferSession.maxRequestBytes,
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
    variants = []
    selectedIndex = nil
    capabilityBody = nil
    owner = nil
    last = nil
    readSinceRequest = false
  }
}

/// What JavaScript hands the native module: the staged variants for one transfer. Parsed and checked here, in pure
/// code, so a builder bug is caught on the phone (and unit-tested on a Mac) and never reaches the Karoo as `bad_hash`.
///
/// ```
/// {"advertiseMs":120000,
///  "resources":{"<pool name>":"<base64>", ...},
///  "variants":[{"name":"ceilings","requires":["planCeilingsV1"],"manifest":"<compact JSON, at most 512 bytes>",
///               "resources":{"plan":"<pool name>","segment":"<pool name>","rider":"...","record":"..."}}, ...]}
/// ```
/// The pool lets variants share the (large) segment bytes instead of repeating them.
struct TransferOffer {
  let transferId: String
  let variants: [TransferVariant]
  let advertiseSeconds: TimeInterval

  enum ParseResult {
    case ok(TransferOffer)
    case invalid(String)
  }

  static let maxManifestBytes = 512
  static let maxVariants = 4
  static let maxAdvertiseSeconds: TimeInterval = 120
  static let resourceCaps: [String: Int] = ["plan": 128 * 1024, "segment": 512 * 1024, "rider": 16 * 1024, "record": 8 * 1024]

  static func parse(_ config: Data) -> ParseResult {
    guard let root = try? JSONSerialization.jsonObject(with: config) as? [String: Any],
          let advertiseMs = (root["advertiseMs"] as? NSNumber)?.doubleValue,
          let poolBase64 = root["resources"] as? [String: String],
          let variantList = root["variants"] as? [[String: Any]] else { return .invalid("The offer is not in the expected shape") }
    guard !variantList.isEmpty, variantList.count <= maxVariants else { return .invalid("The offer needs 1 to \(maxVariants) variants") }

    var pool: [String: Data] = [:]
    for (name, text) in poolBase64 {
      guard let bytes = Data(base64Encoded: text) else { return .invalid("Resource \(name) is not valid base64") }
      pool[name] = bytes
    }

    var variants: [TransferVariant] = []
    var transferId: String?
    var names = Set<String>()
    for entry in variantList {
      guard let name = entry["name"] as? String, name.range(of: "^[a-z0-9]{1,24}$", options: .regularExpression) != nil, names.insert(name).inserted else {
        return .invalid("A variant has a missing, malformed or duplicate name")
      }
      guard let requiresList = entry["requires"] as? [String], requiresList.count <= 2,
            requiresList.allSatisfy({ $0.range(of: "^[A-Za-z0-9]{1,40}$", options: .regularExpression) != nil }),
            Set(requiresList).count == requiresList.count else { return .invalid("Variant \(name) has malformed requirements") }
      guard let manifestText = entry["manifest"] as? String, let manifest = manifestText.data(using: .utf8), manifest.count <= maxManifestBytes,
            let object = try? JSONSerialization.jsonObject(with: manifest) as? [String: Any], (object["v"] as? NSNumber)?.intValue == 2,
            let id = object["transferId"] as? String, id.range(of: "^[A-Za-z0-9_-]{22}$", options: .regularExpression) != nil else {
        return .invalid("Variant \(name) has an invalid manifest")
      }
      if let existing = transferId, existing != id { return .invalid("Variant \(name) has a different transfer id") }
      transferId = id
      guard let map = entry["resources"] as? [String: String] else { return .invalid("Variant \(name) has no resource list") }
      var resources: [String: Data] = [:]
      for (resource, poolName) in map {
        guard let cap = resourceCaps[resource] else { return .invalid("Variant \(name) names an unknown resource") }
        guard let bytes = pool[poolName] else { return .invalid("Variant \(name) refers to a resource that was not supplied") }
        guard bytes.count <= cap else { return .invalid("Variant \(name): \(resource) is over its size limit") }
        resources[resource] = bytes
      }
      guard resources["plan"] != nil else { return .invalid("Variant \(name) has no plan") }
      if let mismatch = TransferSession.manifestMismatch(manifest: manifest, resources: resources) {
        return .invalid("Variant \(name): \(mismatch)")
      }
      variants.append(TransferVariant(name: name, requires: Set(requiresList), manifest: manifest, resources: resources))
    }
    guard variants.contains(where: { $0.requires.isEmpty }), let id = transferId else {
      return .invalid("The offer must include a baseline variant that requires nothing")
    }
    return .ok(TransferOffer(transferId: id, variants: variants, advertiseSeconds: min(max(advertiseMs / 1000.0, 1.0), maxAdvertiseSeconds)))
  }
}
