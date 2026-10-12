// Unit tests for the phone's BLE serving logic (modules/gritmap-ble-peripheral/ios/TransferSession.swift),
// runnable on a Mac with no Bluetooth:
//   swiftc -parse-as-library -o /tmp/test-transfer-session \
//     modules/gritmap-ble-peripheral/ios/TransferSession.swift scripts/test-transfer-session.swift && /tmp/test-transfer-session
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
    check(isRefused(session.readData(central: "A", valueOffset: 600, emit: emit)), "value offset past the chunk is refused")

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

    print(failures == 0 ? "ALL PASSED" : "\(failures) FAILED")
    exit(failures == 0 ? 0 : 1)
  }
}
