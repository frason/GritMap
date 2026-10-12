Pod::Spec.new do |s|
  s.name           = 'GritMapBlePeripheral'
  s.version        = '0.1.0'
  s.summary        = 'GritMap: advertise the Bluetooth transfer token to a Karoo (local module).'
  s.description    = 'A small CoreBluetooth peripheral: advertises one service UUID and serves one read-only characteristic for a bounded time.'
  s.license        = { :type => 'MIT' }
  s.author         = 'GritMap'
  s.homepage       = 'https://github.com/frason/GritMap'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
