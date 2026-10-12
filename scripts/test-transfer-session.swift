// Unit tests for the phone's BLE serving logic (modules/gritmap-ble-peripheral/ios/TransferSession.swift),
// runnable on a Mac with no Bluetooth:
//   swiftc -parse-as-library -o /tmp/test-transfer-session \
//     modules/gritmap-ble-peripheral/ios/TransferSession.swift scripts/test-transfer-session.swift && /tmp/test-transfer-session
import CryptoKit
import Foundation

@main
struct TransferSessionTests {
  static var failures = 0

  static func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    if condition() { print("ok   \(message)") } else { print("FAIL \(message)"); failures += 1 }
  }

  static func json(_ text: String) -> Data { text.data(using: .utf8)! }

  static func isRefused<T>(_ outcome: TransferSession.Outcome<T>) -> Bool {
    if case .refused = outcome { return true }
    return false
  }

  static func isInvalidOffset<T>(_ outcome: TransferSession.Outcome<T>) -> Bool {
    if case .invalidOffset = outcome { return true }
    return false
  }

  static func sha(_ data: Data) -> String {
    SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
  }

  static func value<T>(_ outcome: TransferSession.Outcome<T>) -> T? {
    if case .ok(let v) = outcome { return v }
    return nil
  }

  static func main() {
    let id = "X7kP3m9Qw2AbCd4Ef6Gh8J"
    let plan = Data((0..<1300).map { UInt8($0 % 251) })   // 3 chunks: 512 + 512 + 276
    let segment = Data((0..<10).map { UInt8($0) })
    var events: [TransferSession.Event] = []
    let emit: (TransferSession.Event) -> Void = { events.append($0) }

    // 1. Manifest then chunk walk, reassembled bytes equal the original.
    var session = TransferSession(transferId: id, manifest: json("{\"v\":2}"), resources: ["plan": plan, "segment": segment])
    check(value(session.readManifest(central: "A", emit: emit)) == json("{\"v\":2}"), "manifest is served to the first central")
    var rebuilt = Data()
    var offset = 0
    while offset < plan.count {
      check(!isRefused(session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":\(offset)}"))), "request plan@\(offset) accepted")
      let chunk = value(session.readData(central: "A", valueOffset: 0, emit: emit))!
      check(chunk.count <= 512 && chunk.count > 0, "chunk at \(offset) is 1...512 bytes")
      rebuilt.append(chunk)
      offset += chunk.count
    }
    check(rebuilt == plan, "reassembled plan equals the original bytes")
    check(session.planFullyServed(), "plan reported fully served")
    check(events.contains(.progress(resource: "plan", served: 1300, total: 1300)), "progress reaches the plan length")

    // 2. Long read by value offset.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":0}"))
    let full = value(session.readData(central: "A", valueOffset: 0, emit: emit))!
    let tail = value(session.readData(central: "A", valueOffset: 100, emit: emit))!
    check(tail == full.subdata(in: 100..<full.count), "a blob read at value offset 100 returns the rest of the chunk")
    check(isInvalidOffset(session.readData(central: "A", valueOffset: 600, emit: emit)), "value offset past the chunk is invalidOffset")
    check(value(session.readData(central: "A", valueOffset: 512, emit: emit))?.isEmpty == true, "value offset exactly at the chunk end is an empty success (final blob)")

    // 3. First central owns the session; others refused.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    _ = session.readManifest(central: "A", emit: emit)
    check(isRefused(session.readManifest(central: "B", emit: emit)), "second central cannot read the manifest")
    check(isRefused(session.writeRequest(central: "B", body: json("{\"resource\":\"plan\",\"offset\":0}"))), "second central cannot request")
    check(isRefused(session.writeStatus(central: "B", body: json("{\"transferId\":\"\(id)\",\"status\":\"imported\",\"code\":\"ok\"}"), emit: emit)), "second central cannot write a receipt")

    // 4. Malformed or out-of-range requests.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    check(isRefused(session.readData(central: "A", valueOffset: 0, emit: emit)), "data read before any request is refused")
    for body in ["{\"resource\":\"plan\",\"offset\":1300}", "{\"resource\":\"plan\",\"offset\":-1}", "{\"resource\":\"segment\",\"offset\":0}",
                 "{\"resource\":\"plan\"}", "{\"resource\":\"plan\",\"offset\":0,\"x\":1}", "{\"resource\":\"plan\",\"offset\":1.5}",
                 "{\"resource\":\"plan\",\"offset\":true}", "not json", "{\"resource\":\"plan\",\"offset\":0}" + String(repeating: " ", count: 70)] {
      check(isRefused(session.writeRequest(central: "A", body: json(body))), "refused: \(body.prefix(40))")
    }

    // 5. Receipt: accepted once, with matching id, valid status and code.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    events = []
    check(isRefused(session.writeStatus(central: "A", body: json("{\"transferId\":\"other\",\"status\":\"imported\",\"code\":\"ok\"}"), emit: emit)), "receipt with another transfer id refused")
    check(isRefused(session.writeStatus(central: "A", body: json("{\"transferId\":\"\(id)\",\"status\":\"done\",\"code\":\"ok\"}"), emit: emit)), "receipt with unknown status refused")
    check(isRefused(session.writeStatus(central: "A", body: json("{\"transferId\":\"\(id)\",\"status\":\"imported\",\"code\":\"OK!\"}"), emit: emit)), "receipt with bad code refused")
    check(!isRefused(session.writeStatus(central: "A", body: json("{\"transferId\":\"\(id)\",\"status\":\"rejected\",\"code\":\"bad_hash\"}"), emit: emit)), "valid receipt accepted")
    check(events.contains(.receipt(status: "rejected", code: "bad_hash")), "receipt event emitted")
    check(isRefused(session.writeStatus(central: "A", body: json("{\"transferId\":\"\(id)\",\"status\":\"imported\",\"code\":\"ok\"}"), emit: emit)), "a second receipt is refused")

    // 6. Ending forgets everything.
    session.end()
    check(isRefused(session.readManifest(central: "A", emit: emit)), "after end the manifest is gone")
    check(isRefused(session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":0}"))), "after end requests are refused")


    // 7. P1: a chunk is served only once its last byte has been delivered. With a small MTU the response at
    //    value offset 0 is truncated, so the plan is not "fully served" until the final blob read.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    events = []
    let mtuPayload = 100   // MTU 101: one ATT response carries 100 bytes
    var servedAtFirstPart = false
    for requestOffset in [0, 512, 1024] {
      _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":\(requestOffset)}"), emit: emit)
      var valueOffset = 0
      var got = Data()
      while true {
        let part = value(session.readData(central: "A", valueOffset: valueOffset, maxResponseBytes: mtuPayload, emit: emit))!
        let delivered = part.prefix(mtuPayload)
        got.append(delivered)
        if requestOffset == 1024 && valueOffset == 0 { servedAtFirstPart = session.planFullyServed() }
        valueOffset += delivered.count
        if delivered.count < mtuPayload { break }
      }
      check(got == plan.subdata(in: requestOffset..<min(requestOffset + 512, plan.count)), "chunk at \(requestOffset) reassembled from ATT-sized parts")
    }
    check(!servedAtFirstPart, "P1: the plan is not fully served after only the first (truncated) part of its last chunk")
    check(session.planFullyServed(), "P1: the plan is fully served after the final blob read")
    check(events.filter { if case .progress = $0 { return true } else { return false } }.count == 3, "P1: one progress event per completed chunk")

    // A response that carries the whole remaining chunk completes it without any further blob read.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":1024}"), emit: emit)
    _ = session.readData(central: "A", valueOffset: 0, maxResponseBytes: 276, emit: emit)
    check(session.planFullyServed(), "P1: a response that carries the whole remaining chunk completes it")

    // The next Request after a read settles the previous chunk even if the MTU was not known.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan, "segment": segment])
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":1024}"), emit: emit)
    _ = session.readData(central: "A", valueOffset: 0, maxResponseBytes: 50, emit: emit)
    check(!session.planFullyServed(), "P1: truncated read alone does not complete the chunk")
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"segment\",\"offset\":0}"), emit: emit)
    check(session.planFullyServed(), "P1: the next Request after a read settles the previous chunk")
    // ... but a request without any read does not.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan, "segment": segment])
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":1024}"), emit: emit)
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"segment\",\"offset\":0}"), emit: emit)
    check(!session.planFullyServed(), "P1: a request that was never read does not count as served")
    // The receipt settles the last chunk read.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":1024}"), emit: emit)
    _ = session.readData(central: "A", valueOffset: 0, maxResponseBytes: 50, emit: emit)
    _ = session.writeStatus(central: "A", body: json("{\"transferId\":\"\(id)\",\"status\":\"imported\",\"code\":\"ok\"}"), emit: emit)
    check(session.planFullyServed(), "P1: the receipt implies the last chunk was delivered")

    // 8. P2: ownership holds across a reconnect: the owner is accepted again and can resume; another central is refused.
    session = TransferSession(transferId: id, manifest: json("{\"v\":2}"), resources: ["plan": plan])
    _ = session.readManifest(central: "KAROO", emit: emit)
    _ = session.writeRequest(central: "KAROO", body: json("{\"resource\":\"plan\",\"offset\":0}"), emit: emit)
    _ = session.readData(central: "KAROO", valueOffset: 0, emit: emit)
    // (link drops; the same central comes back and re-reads the manifest, then resumes at its last complete chunk)
    check(value(session.readManifest(central: "KAROO", emit: emit)) == json("{\"v\":2}"), "P2: the owner can read the manifest again after a reconnect")
    check(!isRefused(session.writeRequest(central: "KAROO", body: json("{\"resource\":\"plan\",\"offset\":512}"), emit: emit)), "P2: the owner can resume at a later chunk")
    check(value(session.readData(central: "KAROO", valueOffset: 0, emit: emit))?.count == 512, "P2: the owner's resumed chunk is served")
    check(isRefused(session.readManifest(central: "OTHER", emit: emit)), "P2: a different central is refused the manifest")
    check(isRefused(session.writeRequest(central: "OTHER", body: json("{\"resource\":\"plan\",\"offset\":0}"), emit: emit)), "P2: a different central cannot request")
    check(isRefused(session.readData(central: "OTHER", valueOffset: 0, emit: emit)), "P2: a different central cannot read data")

    // 9. P3: idle limit is 30 s until the plan is fully served, then 60 s for the receipt.
    session = TransferSession(transferId: id, manifest: json("{}"), resources: ["plan": plan])
    check(session.idleLimitSeconds() == 30, "P3: 30 s idle limit before the plan is served")
    check(session.idleOutcome() == "timedOut", "P3: running out of time before the plan is served is a timeout")
    for requestOffset in [0, 512, 1024] {
      _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":\(requestOffset)}"), emit: emit)
      _ = session.readData(central: "A", valueOffset: 0, emit: emit)
    }
    check(session.idleLimitSeconds() == 60, "P3: 60 s receipt window once the plan is fully served")
    check(session.idleOutcome() == "sentUnconfirmed", "P3: running out of time after the plan is served is sentUnconfirmed")

    // 10. P4: invalid offsets, and the manifest/resource consistency check.
    session = TransferSession(transferId: id, manifest: json("{\"v\":2}"), resources: ["plan": plan])
    check(isInvalidOffset(session.readManifest(central: "A", valueOffset: 8, emit: emit)), "P4: manifest read past the end is invalidOffset")
    check(value(session.readManifest(central: "A", valueOffset: 7, emit: emit)) == Data(), "P4: manifest read at exactly the end is an empty success")
    check(value(session.readManifest(central: "A", valueOffset: 3, emit: emit)) == json("{\"v\":2}").subdata(in: 3..<7), "P4: manifest blob read returns the tail")
    _ = session.writeRequest(central: "A", body: json("{\"resource\":\"plan\",\"offset\":1024}"), emit: emit)
    check(isInvalidOffset(session.readData(central: "A", valueOffset: 277, emit: emit)), "P4: data read past the chunk end is invalidOffset")

    func manifest(planBytes: Int, planSha: String, withSegment: Bool = false, segBytes: Int = 0, segSha: String = "") -> Data {
      var text = "{\"v\":2,\"plan\":{\"bytes\":\(planBytes),\"sha256\":\"\(planSha)\"}"
      if withSegment { text += ",\"segment\":{\"bytes\":\(segBytes),\"sha256\":\"\(segSha)\"}" }
      return json(text + "}")
    }
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count, planSha: sha(plan)), resources: ["plan": plan]) == nil, "P4: a consistent manifest passes")
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count, planSha: sha(plan), withSegment: true, segBytes: segment.count, segSha: sha(segment)),
                                           resources: ["plan": plan, "segment": segment]) == nil, "P4: a consistent manifest with a segment passes")
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count + 1, planSha: sha(plan)), resources: ["plan": plan]) != nil, "P4: a wrong plan byte count is caught")
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count, planSha: String(repeating: "0", count: 64)), resources: ["plan": plan]) != nil, "P4: a wrong plan SHA-256 is caught")
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count, planSha: sha(plan), withSegment: true, segBytes: segment.count, segSha: sha(segment)),
                                           resources: ["plan": plan]) != nil, "P4: a manifest listing a segment with no segment bytes is caught")
    check(TransferSession.manifestMismatch(manifest: manifest(planBytes: plan.count, planSha: sha(plan)), resources: ["plan": plan, "segment": segment]) != nil,
          "P4: segment bytes the manifest does not list are caught")
    check(TransferSession.manifestMismatch(manifest: json("not json"), resources: ["plan": plan]) != nil, "P4: a non-JSON manifest is caught")

    print(failures == 0 ? "ALL PASSED" : "\(failures) FAILED")
    exit(failures == 0 ? 0 : 1)
  }
}
