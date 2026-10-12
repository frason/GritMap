import CoreBluetooth
import ExpoModulesCore

/// GATT identifiers from docs/BLE_DIRECT_TRANSFER_CONTRACT.md.
private let transferServiceUUID = CBUUID(string: "E7A4E868-0A21-45D6-AC63-5812C740BA12")
private let manifestUUID = CBUUID(string: "A9C5876C-8F5F-48BE-AAE7-EB47EF573C41")
private let requestUUID = CBUUID(string: "59E28123-C142-4B89-ACBA-57D76E483B72")
private let dataUUID = CBUUID(string: "83E82BA5-A7F4-47C5-BF6C-6473178BEF68")
private let statusUUID = CBUUID(string: "C0BB77AF-3BD8-4C60-B669-91AC74C778B9")

/// Must match modules/gritmap-ble-peripheral/index.ts. Events never carry the transfer's bytes.
private let stateEvent = "onStateChange"

private let inactivitySeconds: TimeInterval = 30
private let sessionCapSeconds: TimeInterval = 600
private let maxAdvertiseSeconds: TimeInterval = 120

/// A bounded, one-shot BLE peripheral for one transfer. It advertises only the transfer service UUID
/// until a central reads the manifest, then serves that central alone. The bytes live in memory only,
/// are never logged, and are dropped on every exit (receipt, timeout, background, stop).
private final class TransferPeripheral: NSObject, CBPeripheralManagerDelegate {
  private var manager: CBPeripheralManager?
  private var session: TransferSession?
  private var pendingStart = false
  private var advertiseTimer: DispatchWorkItem?
  private var inactivityTimer: DispatchWorkItem?
  private var capTimer: DispatchWorkItem?
  private var finishing = false
  private var connected = false
  private let emit: ([String: Any]) -> Void

  init(emit: @escaping ([String: Any]) -> Void) {
    self.emit = emit
  }

  func start(session: TransferSession, advertiseSeconds: TimeInterval) {
    stop(reason: nil)
    self.session = session
    finishing = false
    connected = false
    pendingStart = true
    schedule(&advertiseTimer, after: advertiseSeconds) { [weak self] in self?.finish("timedOut") }
    if manager == nil {
      manager = CBPeripheralManager(delegate: self, queue: .main)  // the permission prompt appears here
    } else {
      beginIfPoweredOn()
    }
  }

  func stop(reason: String?) {
    guard session != nil || pendingStart else { return }
    teardown()
    if let reason = reason { emit(["state": reason]) }
  }

  private func schedule(_ slot: inout DispatchWorkItem?, after seconds: TimeInterval, _ work: @escaping () -> Void) {
    slot?.cancel()
    let item = DispatchWorkItem(block: work)
    slot = item
    DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: item)
  }

  private func finish(_ state: String, extra: [String: Any] = [:]) {
    guard !finishing else { return }
    finishing = true
    teardown()
    var body: [String: Any] = ["state": state]
    for (key, value) in extra { body[key] = value }
    emit(body)
  }

  private func teardown() {
    advertiseTimer?.cancel(); advertiseTimer = nil
    inactivityTimer?.cancel(); inactivityTimer = nil
    capTimer?.cancel(); capTimer = nil
    pendingStart = false
    session?.end()
    session = nil
    if let manager = manager {
      manager.stopAdvertising()
      manager.removeAllServices()
    }
  }

  private func beginIfPoweredOn() {
    guard pendingStart, let manager = manager else { return }
    switch manager.state {
    case .poweredOn:
      pendingStart = false
      let service = CBMutableService(type: transferServiceUUID, primary: true)
      service.characteristics = [
        CBMutableCharacteristic(type: manifestUUID, properties: [.read], value: nil, permissions: [.readable]),
        CBMutableCharacteristic(type: requestUUID, properties: [.write], value: nil, permissions: [.writeable]),
        CBMutableCharacteristic(type: dataUUID, properties: [.read], value: nil, permissions: [.readable]),
        CBMutableCharacteristic(type: statusUUID, properties: [.write], value: nil, permissions: [.writeable]),
      ]
      manager.add(service)
    case .poweredOff: finish("poweredOff")
    case .unauthorized: finish("unauthorized")
    case .unsupported: finish("unsupported")
    default: break  // unknown / resetting: wait for the next update
    }
  }

  private func touch() {
    schedule(&inactivityTimer, after: inactivitySeconds) { [weak self] in
      guard let self = self, let session = self.session else { return }
      // Plan fully read but no receipt: the most we can honestly say is "sent".
      self.finish(session.planFullyServed() ? "sentUnconfirmed" : "timedOut")
    }
  }

  private func handle(_ event: TransferSession.Event) {
    switch event {
    case .manifestRead:
      if connected { return }  // a long read arrives as several reads
      connected = true
      // The Karoo has found us: stop advertising and keep serving only it.
      advertiseTimer?.cancel(); advertiseTimer = nil
      manager?.stopAdvertising()
      schedule(&capTimer, after: sessionCapSeconds) { [weak self] in self?.finish("timedOut") }
      touch()
      emit(["state": "connected"])
    case .progress(let resource, let served, let total):
      emit(["state": "progress", "resource": resource, "served": served, "total": total])
    case .receipt(let status, let code):
      // Let the write response reach the Karoo before tearing the service down.
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
        self?.finish("receipt", extra: ["status": status, "code": code])
      }
    }
  }

  // MARK: CBPeripheralManagerDelegate

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard session != nil else { return }
    switch peripheral.state {
    case .poweredOn: beginIfPoweredOn()
    case .poweredOff: finish("poweredOff")
    case .unauthorized: finish("unauthorized")
    case .unsupported: finish("unsupported")
    default: break
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    if error != nil { finish("error"); return }
    // Advertise the service UUID only: no local name, no other data.
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [transferServiceUUID]])
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if error != nil { finish("error") } else { emit(["state": "advertising"]) }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    guard let session = session else {
      peripheral.respond(to: request, withResult: .attributeNotFound)
      return
    }
    let central = request.central.identifier.uuidString
    let outcome: TransferSession.Outcome<Data>
    switch request.characteristic.uuid {
    case manifestUUID:
      outcome = session.readManifest(central: central) { self.handle($0) }
    case dataUUID:
      outcome = session.readData(central: central, valueOffset: request.offset) { self.handle($0) }
      touch()
    default:
      peripheral.respond(to: request, withResult: .attributeNotFound)
      return
    }
    switch outcome {
    case .ok(let data):
      request.value = request.characteristic.uuid == manifestUUID && request.offset > 0
        ? (request.offset <= data.count ? data.subdata(in: request.offset..<data.count) : Data())
        : data
      peripheral.respond(to: request, withResult: .success)
    case .refused:
      peripheral.respond(to: request, withResult: .readNotPermitted)
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    guard let session = session, let first = requests.first else { return }
    var allowed = true
    for request in requests {
      let central = request.central.identifier.uuidString
      let body = request.value ?? Data()
      switch request.characteristic.uuid {
      case requestUUID:
        if case .refused = session.writeRequest(central: central, body: body) { allowed = false } else { touch() }
      case statusUUID:
        if case .refused = session.writeStatus(central: central, body: body, emit: { self.handle($0) }) { allowed = false }
      default:
        allowed = false
      }
    }
    peripheral.respond(to: first, withResult: allowed ? .success : .writeNotPermitted)
  }
}

public final class GritMapBlePeripheralModule: Module {
  private lazy var peripheral = TransferPeripheral { [weak self] body in
    self?.sendEvent(stateEvent, body)
  }

  public func definition() -> ModuleDefinition {
    Name("GritMapBlePeripheral")

    Events(stateEvent)

    /// Offers one transfer: `manifest` (compact JSON, at most 512 bytes) and the exact resource bytes, base64 encoded.
    Function("startTransfer") { (manifest: String, planBase64: String, segmentBase64: String?, riderBase64: String?, advertiseMs: Double) throws in
      guard let manifestData = manifest.data(using: .utf8), manifestData.count <= 512,
            let object = try? JSONSerialization.jsonObject(with: manifestData) as? [String: Any],
            object["v"] as? Int == 2,
            let transferId = object["transferId"] as? String,
            transferId.range(of: "^[A-Za-z0-9_-]{22}$", options: .regularExpression) != nil,
            let plan = Data(base64Encoded: planBase64), plan.count <= 128 * 1024 else {
        throw Exception(name: "ERR_INVALID_TRANSFER", description: "Not a valid transfer manifest or plan")
      }
      var resources: [String: Data] = ["plan": plan]
      if let segmentBase64 = segmentBase64 {
        guard let segment = Data(base64Encoded: segmentBase64), segment.count <= 512 * 1024 else {
          throw Exception(name: "ERR_INVALID_TRANSFER", description: "Invalid segment")
        }
        resources["segment"] = segment
      }
      if let riderBase64 = riderBase64 {
        guard let rider = Data(base64Encoded: riderBase64), rider.count <= 16 * 1024 else {
          throw Exception(name: "ERR_INVALID_TRANSFER", description: "Invalid rider")
        }
        resources["rider"] = rider
      }
      let session = TransferSession(transferId: transferId, manifest: manifestData, resources: resources)
      self.peripheral.start(session: session, advertiseSeconds: min(max(advertiseMs / 1000.0, 1.0), maxAdvertiseSeconds))
    }

    Function("stopTransfer") {
      self.peripheral.stop(reason: "stopped")
    }

    // iOS does not reliably serve a custom service to other centrals once backgrounded; stop instead of appearing to offer it.
    OnAppEntersBackground {
      self.peripheral.stop(reason: "stopped")
    }

    OnDestroy {
      self.peripheral.stop(reason: nil)
    }
  }
}
