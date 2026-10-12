// DEVELOPMENT ONLY. A macOS "fake Karoo" central for the phone's Bluetooth transfer
// (docs/BLE_DIRECT_TRANSFER_CONTRACT.md): scans for the GritMap service, reads the manifest, walks the plan
// chunks (and the segment unless --skip-segment), verifies length and SHA-256, and optionally writes a receipt.
//
//   swiftc -o /tmp/fake-karoo scripts/fake-karoo.swift && /tmp/fake-karoo [--skip-segment] [--receipt imported|rejected]
//
// Needs Bluetooth permission for your terminal (System Settings > Privacy & Security > Bluetooth), and a
// PHYSICAL iPhone advertising (the simulator has no radio). UNTESTED against a real iPhone as of this commit.
// Prints sizes, hashes OK/FAIL and progress only; never the plan or segment contents.
import CoreBluetooth
import CryptoKit
import Foundation

let serviceUUID = CBUUID(string: "E7A4E868-0A21-45D6-AC63-5812C740BA12")
let manifestUUID = CBUUID(string: "A9C5876C-8F5F-48BE-AAE7-EB47EF573C41")
let requestUUID = CBUUID(string: "59E28123-C142-4B89-ACBA-57D76E483B72")
let dataUUID = CBUUID(string: "83E82BA5-A7F4-47C5-BF6C-6473178BEF68")
let statusUUID = CBUUID(string: "C0BB77AF-3BD8-4C60-B669-91AC74C778B9")

let args = CommandLine.arguments
let skipSegment = args.contains("--skip-segment")
let receiptStatus: String? = args.firstIndex(of: "--receipt").flatMap { $0 + 1 < args.count ? args[$0 + 1] : nil }

struct Job { let name: String; let bytes: Int; let sha: String }

final class FakeKaroo: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
  var central: CBCentralManager!
  var peripheral: CBPeripheral?
  var chars: [CBUUID: CBCharacteristic] = [:]
  var transferId = ""
  var jobs: [Job] = []
  var current: Job?
  var buffer = Data()

  override init() {
    super.init()
    central = CBCentralManager(delegate: self, queue: nil)
  }

  func fail(_ message: String, code: Int32 = 1) -> Never { print("FAIL: \(message)"); exit(code) }

  func centralManagerDidUpdateState(_ central: CBCentralManager) {
    guard central.state == .poweredOn else { print("Bluetooth state \(central.state.rawValue): needs poweredOn + permission"); return }
    print("Scanning for the GritMap transfer service (up to 120 s)...")
    central.scanForPeripherals(withServices: [serviceUUID])
    DispatchQueue.main.asyncAfter(deadline: .now() + 120) { self.fail("no advertiser found", code: 2) }
  }

  func centralManager(_ central: CBCentralManager, didDiscover p: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
    print("Found advertiser (RSSI \(rssi)); local name present: \(advertisementData[CBAdvertisementDataLocalNameKey] != nil)")
    central.stopScan()
    peripheral = p
    p.delegate = self
    central.connect(p)
  }

  func centralManager(_ central: CBCentralManager, didConnect p: CBPeripheral) { p.discoverServices([serviceUUID]) }

  func peripheral(_ p: CBPeripheral, didDiscoverServices error: Error?) {
    guard let s = p.services?.first else { fail("service missing") }
    p.discoverCharacteristics([manifestUUID, requestUUID, dataUUID, statusUUID], for: s)
  }

  func peripheral(_ p: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
    for c in service.characteristics ?? [] { chars[c.uuid] = c }
    guard chars.count == 4 else { fail("expected 4 characteristics, found \(chars.count)") }
    p.readValue(for: chars[manifestUUID]!)
  }

  func nextJob() {
    guard let job = jobs.first else { finish(); return }
    current = job
    buffer = Data()
    request(offset: 0)
  }

  func request(offset: Int) {
    let body = "{\"resource\":\"\(current!.name)\",\"offset\":\(offset)}".data(using: .utf8)!
    peripheral!.writeValue(body, for: chars[requestUUID]!, type: .withResponse)
  }

  func peripheral(_ p: CBPeripheral, didWriteValueFor c: CBCharacteristic, error: Error?) {
    if let error = error { fail("write failed: \(error.localizedDescription)") }
    if c.uuid == requestUUID { p.readValue(for: chars[dataUUID]!) }
    if c.uuid == statusUUID { print("Receipt written."); exit(0) }
  }

  func peripheral(_ p: CBPeripheral, didUpdateValueFor c: CBCharacteristic, error: Error?) {
    if let error = error { fail("read failed: \(error.localizedDescription)") }
    guard let value = c.value else { fail("empty read") }
    if c.uuid == manifestUUID {
      guard value.count <= 512, let o = try? JSONSerialization.jsonObject(with: value) as? [String: Any],
            o["v"] as? Int == 2, let id = o["transferId"] as? String,
            let plan = o["plan"] as? [String: Any], let seg = o["segment"] as? [String: Any] else { fail("manifest invalid") }
      transferId = id
      print("Manifest OK (\(value.count) bytes); segment public flag: \(seg["public"] != nil); rider offered: \(o["rider"] != nil)")
      jobs.append(Job(name: "plan", bytes: plan["bytes"] as! Int, sha: plan["sha256"] as! String))
      if !skipSegment { jobs.append(Job(name: "segment", bytes: seg["bytes"] as! Int, sha: seg["sha256"] as! String)) }
      if let r = o["rider"] as? [String: Any] { jobs.append(Job(name: "rider", bytes: r["bytes"] as! Int, sha: r["sha256"] as! String)) }
      nextJob()
    } else if c.uuid == dataUUID, let job = current {
      buffer.append(value)
      if buffer.count < job.bytes {
        request(offset: buffer.count)
      } else {
        let digest = SHA256.hash(data: buffer).map { String(format: "%02x", $0) }.joined()
        print("\(job.name): \(buffer.count) bytes, SHA-256 \(digest == job.sha && buffer.count == job.bytes ? "OK" : "MISMATCH")")
        jobs.removeFirst()
        nextJob()
      }
    }
  }

  func finish() {
    guard let status = receiptStatus else { print("Transfer read complete (no receipt written)."); exit(0) }
    let body = "{\"transferId\":\"\(transferId)\",\"status\":\"\(status)\",\"code\":\"\(status == "imported" ? "ok" : "other")\"}".data(using: .utf8)!
    peripheral!.writeValue(body, for: chars[statusUUID]!, type: .withResponse)
  }
}

let karoo = FakeKaroo()
RunLoop.main.run()
