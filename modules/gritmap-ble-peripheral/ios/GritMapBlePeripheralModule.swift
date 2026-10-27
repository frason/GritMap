import CoreBluetooth
import ExpoModulesCore

/// GATT identifiers from docs/BLE_DIRECT_TRANSFER_CONTRACT.md.
private let transferServiceUUID = CBUUID(string: "E7A4E868-0A21-45D6-AC63-5812C740BA12")
private let manifestUUID = CBUUID(string: "A9C5876C-8F5F-48BE-AAE7-EB47EF573C41")
private let requestUUID = CBUUID(string: "59E28123-C142-4B89-ACBA-57D76E483B72")
private let dataUUID = CBUUID(string: "83E82BA5-A7F4-47C5-BF6C-6473178BEF68")
private let statusUUID = CBUUID(string: "C0BB77AF-3BD8-4C60-B669-91AC74C778B9")
/// Optional: a receiver that understands pacing extensions writes its capabilities here before reading the
/// manifest (docs/RECEIVER_CAPABILITIES_CONTRACT.md). Old Karoos never do, and are served the baseline variant.
private let capabilitiesUUID = CBUUID(string: "9AA66E90-1C9E-46E1-9E52-45FD6A40847A")

/// Must match modules/gritmap-ble-peripheral/index.ts. Events never carry the transfer's bytes.
private let stateEvent = "onStateChange"

private let sessionCapSeconds: TimeInterval = 600
private let maxAdvertiseSeconds: TimeInterval = 120

/// A bounded, one-shot BLE peripheral for one transfer. It advertises only the transfer service UUID
/// for the whole session; the first central to read the manifest owns the session and every other
/// central is refused, so the owning Karoo can reconnect after a dropped link and resume. The bytes live
/// in memory only, are never logged, and are dropped on every exit (receipt, timeout, background, stop).
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
        CBMutableCharacteristic(type: capabilitiesUUID, properties: [.write], value: nil, permissions: [.writeable]),
      ]
      manager.add(service)
    case .poweredOff: finish("poweredOff")
    case .unauthorized: finish("unauthorized")
    case .unsupported: finish("unsupported")
    default: break  // unknown / resetting: wait for the next update
    }
  }

  /// Restarts the idle timer: 30 s while the Karoo is reading, 60 s once the plan is fully served (the Karoo
  /// is importing and will write the receipt).
  private func touch() {
    guard let session = session else { return }
    schedule(&inactivityTimer, after: session.idleLimitSeconds()) { [weak self] in
      guard let self = self, let session = self.session else { return }
      // Plan fully read but no receipt: the most we can honestly say is "sent".
      self.finish(session.idleOutcome())
    }
  }

  /// The Karoo has found us (by its capabilities write or its first manifest read): the discovery window is
  /// over. Keep advertising, so the same Karoo can reconnect and resume, but the session is locked to it
  /// (other centrals are refused).
  private func markConnected() {
    if connected { return }  // a long read arrives as several reads
    connected = true
    advertiseTimer?.cancel(); advertiseTimer = nil
    schedule(&capTimer, after: sessionCapSeconds) { [weak self] in
      guard let self = self, let session = self.session else { return }
      self.finish(session.idleOutcome())
    }
    emit(["state": "connected"])
  }

  private func handle(_ event: TransferSession.Event) {
    switch event {
    case .variant(let name, let advertised):
      // Which offer was frozen for this Karoo ("baseline" or a richer one), and whether it advertised capabilities. Never any content.
      markConnected()
      emit(["state": "variant", "variant": name, "advertised": advertised])
    case .manifestRead:
      markConnected()
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
      outcome = session.readManifest(central: central, valueOffset: request.offset) { self.handle($0) }
    case dataUUID:
      // One ATT read response carries at most MTU - 1 bytes; maximumUpdateValueLength is MTU - 3.
      outcome = session.readData(central: central, valueOffset: request.offset,
                                 maxResponseBytes: request.central.maximumUpdateValueLength + 2) { self.handle($0) }
    default:
      peripheral.respond(to: request, withResult: .attributeNotFound)
      return
    }
    switch outcome {
    case .ok(let data):
      request.value = data
      touch()
      peripheral.respond(to: request, withResult: .success)
    case .invalidOffset:
      peripheral.respond(to: request, withResult: .invalidOffset)
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
        if case .ok = session.writeRequest(central: central, body: body, emit: { self.handle($0) }) { touch() } else { allowed = false }
      case capabilitiesUUID:
        if case .ok = session.writeCapabilities(central: central, body: body, emit: { self.handle($0) }) { touch() } else { allowed = false }
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
      if let mismatch = TransferSession.manifestMismatch(manifest: manifestData, resources: resources) {
        throw Exception(name: "ERR_INVALID_TRANSFER", description: "Manifest does not match the resources: \(mismatch)")
      }
      let session = TransferSession(transferId: transferId, manifest: manifestData, resources: resources)
      self.peripheral.start(session: session, advertiseSeconds: min(max(advertiseMs / 1000.0, 1.0), maxAdvertiseSeconds))
    }

    /// Offers one transfer as several staged variants (a baseline every Karoo can read, and richer ones for receivers
    /// that advertise the matching features). `config` is JSON, see `TransferOffer`; nothing in it is ever logged.
    Function("startTransferVariants") { (config: String) throws in
      guard let data = config.data(using: .utf8) else {
        throw Exception(name: "ERR_INVALID_TRANSFER", description: "Not a valid transfer offer")
      }
      switch TransferOffer.parse(data) {
      case .invalid(let reason):
        throw Exception(name: "ERR_INVALID_TRANSFER", description: reason)
      case .ok(let offer):
        let session = TransferSession(transferId: offer.transferId, variants: offer.variants)
        self.peripheral.start(session: session, advertiseSeconds: offer.advertiseSeconds)
      }
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
