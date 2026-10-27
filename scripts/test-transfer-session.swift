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

    // 11. Receiver capabilities (docs/RECEIVER_CAPABILITIES_CONTRACT.md): staged variants, one chosen and frozen.
    let capsFixture = FileManager.default.contents(atPath: "fixtures/contracts/receiver-capabilities-v1.json")!
    func caps(_ text: String) -> Data { json(text) }
    func capsJSON(features: String = "[\"planCeilingsV1\",\"segmentRecordV1\"]", maxRecord: Int = 8192, v: Int = 1) -> Data {
      json("{\"v\":\(v),\"transferId\":0,\"versionCode\":74,\"features\":\(features),\"maxManifestBytes\":512,\"maxRecordBytes\":\(maxRecord)}".replacingOccurrences(of: "\"transferId\":0", with: "\"transferV\":2"))
    }
    let basePlan = Data((0..<700).map { UInt8($0 % 241) })
    let ceilPlan = Data((0..<760).map { UInt8($0 % 239) })
    let record = Data((0..<300).map { UInt8($0 % 233) })
    let rider = Data((0..<40).map { UInt8($0) })
    func variantSet() -> [TransferVariant] {
      [
        TransferVariant(name: "full", requires: ["planCeilingsV1", "segmentRecordV1"], manifest: json("{\"v\":2,\"m\":\"full\"}"),
                        resources: ["plan": ceilPlan, "segment": segment, "rider": rider, "record": record]),
        TransferVariant(name: "ceilings", requires: ["planCeilingsV1"], manifest: json("{\"v\":2,\"m\":\"ceilings\"}"),
                        resources: ["plan": ceilPlan, "segment": segment, "rider": rider]),
        TransferVariant(name: "baseline", requires: [], manifest: json("{\"v\":2,\"m\":\"baseline\"}"),
                        resources: ["plan": basePlan, "segment": segment, "rider": rider]),
      ]
    }
    func chosen(_ body: Data?) -> String? {
      let s = TransferSession(transferId: id, variants: variantSet())
      if let body = body { _ = s.writeCapabilities(central: "K", body: body) } else { _ = s.readManifest(central: "K", emit: { _ in }) }
      return s.selectedName
    }
    check(ReceiverCapabilities.parse(capsFixture) != nil, "C1: the shared receiver-capabilities fixture parses")
    check(chosen(capsFixture) == "full", "C1: the fixture's advertisement (ceilings and record) selects the richest variant")
    check(chosen(nil) == "baseline", "C2: a Karoo that never writes capabilities (every released one) gets the baseline variant")
    check(chosen(capsJSON(features: "[\"planCeilingsV1\"]", maxRecord: 0)) == "ceilings", "C3: ceilings only selects the ceilings variant, without the record")
    check(chosen(capsJSON(features: "[\"segmentRecordV1\"]")) == "baseline", "C3: a record-only advertisement has no matching variant, so baseline")
    check(chosen(capsJSON(features: "[]", maxRecord: 0)) == "baseline", "C4: an empty feature list means baseline")
    check(chosen(capsJSON(features: "[\"somethingNew\"]")) == "baseline", "C4: an unknown feature grants nothing")
    check(chosen(capsJSON(features: "[\"planCeilingsV1\",\"somethingNew\"]", maxRecord: 0)) == "ceilings", "C4: an unknown feature beside a known one still grants only the known one")
    check(chosen(capsJSON(v: 2)) == "baseline", "C4: a future advertisement version means baseline")
    check(chosen(caps("not json")) == "baseline", "C4: a malformed advertisement means baseline")
    check(chosen(caps("{\"v\":1}")) == "baseline", "C4: an advertisement with missing keys means baseline")
    check(chosen(capsJSON(features: "[\"planCeilingsV1\",\"planCeilingsV1\"]", maxRecord: 0)) == "baseline", "C4: duplicate features are malformed, so baseline")
    check(chosen(capsJSON(features: "[true]")) == "baseline", "C4: a non-string feature is malformed, so baseline")
    check(chosen(capsJSON(features: "[\"planCeilingsV1\",\"segmentRecordV1\"]", maxRecord: 100)) == "ceilings", "C5: a record bigger than the advertised limit drops to the variant without it")
    check(chosen(json("{\"v\":1,\"transferV\":2,\"versionCode\":74,\"features\":[\"planCeilingsV1\"],\"maxManifestBytes\":513,\"maxRecordBytes\":0}")) == "baseline", "C5: a manifest limit other than 512 is malformed, so baseline")

    // The chosen variant's exact bytes and manifest are what is served, and they stay frozen.
    session = TransferSession(transferId: id, variants: variantSet())
    events = []
    check(!isRefused(session.writeCapabilities(central: "K", body: capsFixture, emit: emit)), "C6: the capabilities write is accepted")
    check(events.contains(.variant("full", advertised: true)), "C6: the choice is reported as an event, with the advertisement noted")
    check(value(session.readManifest(central: "K", emit: emit)) == json("{\"v\":2,\"m\":\"full\"}"), "C6: the manifest of the chosen variant is served")
    _ = session.writeRequest(central: "K", body: json("{\"resource\":\"plan\",\"offset\":512}"), emit: emit)
    check(value(session.readData(central: "K", valueOffset: 0, emit: emit)) == ceilPlan.subdata(in: 512..<ceilPlan.count), "C6: plan chunks come from the chosen variant's plan")
    _ = session.writeRequest(central: "K", body: json("{\"resource\":\"record\",\"offset\":0}"), emit: emit)
    check(value(session.readData(central: "K", valueOffset: 0, emit: emit)) == record, "C6: the record resource is served when the chosen variant has one")
    check(events.contains(.progress(resource: "plan", served: ceilPlan.count, total: ceilPlan.count)), "C6: plan progress and completion use the chosen variant's plan length")
    check(session.planFullyServed(), "C6: the chosen variant's plan counts as fully served after its last chunk")

    session = TransferSession(transferId: id, variants: variantSet())
    _ = session.readManifest(central: "K", emit: emit)
    check(isRefused(session.writeRequest(central: "K", body: json("{\"resource\":\"record\",\"offset\":0}"))), "C7: a baseline transfer refuses a request for the record")
    check(isRefused(session.writeCapabilities(central: "K", body: capsFixture)), "C7: capabilities written after the manifest was chosen are refused")
    check(value(session.readManifest(central: "K", emit: emit)) == json("{\"v\":2,\"m\":\"baseline\"}"), "C7: the baseline manifest stays frozen")

    // Idempotent rewrite on reconnect; a changed one is refused; another central is refused throughout.
    session = TransferSession(transferId: id, variants: variantSet())
    events = []
    _ = session.writeCapabilities(central: "K", body: capsFixture, emit: emit)
    _ = session.readManifest(central: "K", emit: emit)
    _ = session.writeRequest(central: "K", body: json("{\"resource\":\"plan\",\"offset\":0}"), emit: emit)
    _ = session.readData(central: "K", valueOffset: 0, emit: emit)
    events = []
    check(!isRefused(session.writeCapabilities(central: "K", body: capsFixture, emit: emit)), "C8: an identical capabilities write on reconnect is accepted")
    check(events.isEmpty, "C8: ... and changes nothing (no new choice, no reset)")
    check(session.selectedName == "full", "C8: the frozen variant is unchanged")
    check(!isRefused(session.writeRequest(central: "K", body: json("{\"resource\":\"plan\",\"offset\":512}"), emit: emit)), "C8: the owner can resume after the rewrite")
    check(isRefused(session.writeCapabilities(central: "K", body: capsJSON(features: "[]", maxRecord: 0))), "C8: a changed capabilities write is refused")
    check(session.selectedName == "full", "C8: a refused change leaves the choice alone")
    check(isRefused(session.writeCapabilities(central: "OTHER", body: capsFixture)), "C8: another central cannot write capabilities")
    check(isRefused(session.readManifest(central: "OTHER", emit: emit)), "C8: another central cannot read the manifest")
    session = TransferSession(transferId: id, variants: variantSet())
    _ = session.writeCapabilities(central: "K", body: capsFixture, emit: emit)
    check(isRefused(session.readManifest(central: "OTHER", emit: emit)), "C8: the first capabilities write claims the session")
    session = TransferSession(transferId: id, variants: variantSet())
    _ = session.writeCapabilities(central: "K", body: json("garbage"), emit: emit)
    check(session.selectedName == "baseline", "C8: a malformed write is accepted and freezes the baseline")
    check(!isRefused(session.writeCapabilities(central: "K", body: json("garbage"), emit: emit)), "C8: repeating the same malformed write is still idempotent")
    session.end()
    check(isRefused(session.writeCapabilities(central: "K", body: capsFixture)), "C9: after end the capabilities write is refused")

    // Whether the Karoo advertised at all is reported, so the phone can tell "old Karoo" from "newer Karoo that fell back".
    func variantEvent(_ body: Data?) -> TransferSession.Event? {
      var seen: TransferSession.Event?
      let s = TransferSession(transferId: id, variants: variantSet())
      let capture: (TransferSession.Event) -> Void = { if case .variant = $0 { seen = $0 } }
      if let body = body { _ = s.writeCapabilities(central: "K", body: body, emit: capture) } else { _ = s.readManifest(central: "K", emit: capture) }
      return seen
    }
    check(variantEvent(nil) == .variant("baseline", advertised: false), "C11: a Karoo that never writes capabilities is reported as not advertised")
    check(variantEvent(capsFixture) == .variant("full", advertised: true), "C11: a valid advertisement is reported as advertised")
    check(variantEvent(capsJSON(features: "[]", maxRecord: 0)) == .variant("baseline", advertised: true), "C11: a valid advertisement with no usable features is advertised, and fell back to baseline")
    check(variantEvent(json("garbage")) == .variant("baseline", advertised: false), "C11: a malformed advertisement counts as not advertised")
    check(variantEvent(capsJSON(v: 2)) == .variant("baseline", advertised: false), "C11: a future-version advertisement counts as not advertised")

    // The consistency check knows the record resource.
    func recordManifest(recordBytes: Int, recordSha: String) -> Data {
      json("{\"v\":2,\"plan\":{\"bytes\":\(basePlan.count),\"sha256\":\"\(sha(basePlan))\"},\"record\":{\"bytes\":\(recordBytes),\"sha256\":\"\(recordSha)\"}}")
    }
    check(TransferSession.manifestMismatch(manifest: recordManifest(recordBytes: record.count, recordSha: sha(record)), resources: ["plan": basePlan, "record": record]) == nil, "C10: a consistent manifest with a record passes")
    check(TransferSession.manifestMismatch(manifest: recordManifest(recordBytes: record.count, recordSha: String(repeating: "0", count: 64)), resources: ["plan": basePlan, "record": record]) != nil, "C10: a wrong record SHA-256 is caught")
    check(TransferSession.manifestMismatch(manifest: recordManifest(recordBytes: record.count, recordSha: sha(record)), resources: ["plan": basePlan]) != nil, "C10: a record the manifest lists but no bytes were given is caught")

    // 12. The offer JavaScript hands the native module is parsed and checked in pure code.
    func b64(_ d: Data) -> String { d.base64EncodedString() }
    func man(_ planData: Data, record recordData: Data? = nil, id manifestId: String = id) -> String {
      var text = "{\"v\":2,\"transferId\":\"\(manifestId)\",\"plan\":{\"bytes\":\(planData.count),\"sha256\":\"\(sha(planData))\"}"
      if let r = recordData { text += ",\"record\":{\"bytes\":\(r.count),\"sha256\":\"\(sha(r))\"}" }
      return text + "}"
    }
    func offer(_ variants: [[String: Any]], pool: [String: Data], advertiseMs: Double = 120000) -> TransferOffer.ParseResult {
      let object: [String: Any] = ["advertiseMs": advertiseMs, "resources": pool.mapValues { b64($0) }, "variants": variants]
      return TransferOffer.parse(try! JSONSerialization.data(withJSONObject: object))
    }
    func okOffer(_ r: TransferOffer.ParseResult) -> TransferOffer? { if case .ok(let o) = r { return o } else { return nil } }
    func invalidText(_ r: TransferOffer.ParseResult) -> String? { if case .invalid(let m) = r { return m } else { return nil } }
    let goodPool: [String: Data] = ["plan": basePlan, "planC": ceilPlan, "record": record]
    let baselineV: [String: Any] = ["name": "baseline", "requires": [String](), "manifest": man(basePlan), "resources": ["plan": "plan"]]
    let ceilingsV: [String: Any] = ["name": "ceilings", "requires": ["planCeilingsV1"], "manifest": man(ceilPlan, record: record), "resources": ["plan": "planC", "record": "record"]]
    let parsed = okOffer(offer([ceilingsV, baselineV], pool: goodPool))
    check(parsed != nil, "O1: a well-formed offer with a baseline and a richer variant parses")
    check(parsed?.variants.map { $0.name } == ["ceilings", "baseline"], "O1: variants keep their order")
    check(parsed?.transferId == id, "O1: the transfer id comes from the manifests")
    check(parsed?.advertiseSeconds == 120, "O1: the advertise window is carried over")
    check(okOffer(offer([baselineV], pool: goodPool, advertiseMs: 999_000))?.advertiseSeconds == 120, "O1: the advertise window is capped at 2 minutes")
    check(invalidText(offer([ceilingsV], pool: goodPool)) != nil, "O2: an offer with no baseline variant is refused")
    check(invalidText(offer([], pool: goodPool)) != nil, "O2: an offer with no variants is refused")
    check(invalidText(offer([baselineV, baselineV], pool: goodPool)) != nil, "O2: duplicate variant names are refused")
    var otherId = baselineV; otherId["name"] = "second"; otherId["manifest"] = man(basePlan, id: "AAAAAAAAAAAAAAAAAAAAAA")
    check(invalidText(offer([baselineV, otherId], pool: goodPool)) != nil, "O3: variants with different transfer ids are refused")
    var badHash = baselineV; badHash["manifest"] = man(ceilPlan)
    check(invalidText(offer([badHash], pool: goodPool)) != nil, "O3: a manifest whose hash does not match its bytes is refused")
    var missingPool = baselineV; missingPool["resources"] = ["plan": "nowhere"]
    check(invalidText(offer([missingPool], pool: goodPool)) != nil, "O3: a resource that was not supplied is refused")
    var unknownResource = baselineV; unknownResource["resources"] = ["plan": "plan", "secret": "plan"]
    check(invalidText(offer([unknownResource], pool: goodPool)) != nil, "O3: an unknown resource name is refused")
    let bigRecord = Data(repeating: 7, count: 8193)
    var tooBig = ceilingsV; tooBig["manifest"] = man(ceilPlan, record: bigRecord)
    check(invalidText(offer([tooBig, baselineV], pool: ["plan": basePlan, "planC": ceilPlan, "record": bigRecord])) != nil, "O4: a record over 8192 bytes is refused")
    var manyReqs = ceilingsV; manyReqs["requires"] = ["a", "b", "c"]
    check(invalidText(offer([manyReqs, baselineV], pool: goodPool)) != nil, "O4: more than two required features is refused")
    var longManifest = baselineV; longManifest["manifest"] = man(basePlan) + String(repeating: " ", count: 600)
    check(invalidText(offer([longManifest], pool: goodPool)) != nil, "O4: a manifest over 512 bytes is refused")
    check(invalidText(TransferOffer.parse(json("nope"))) != nil, "O5: something that is not JSON is refused")
    let offered = okOffer(offer([ceilingsV, baselineV], pool: goodPool))!
    let fromOffer = TransferSession(transferId: offered.transferId, variants: offered.variants)
    _ = fromOffer.writeCapabilities(central: "K", body: capsJSON(features: "[\"planCeilingsV1\"]", maxRecord: 8192))
    check(fromOffer.selectedName == "ceilings", "O6: a parsed offer selects by the advertised features")

    print(failures == 0 ? "ALL PASSED" : "\(failures) FAILED")
    exit(failures == 0 ? 0 : 1)
  }
}
