package com.gritmap.karoo.physiology

/** Never guesses when more than one plausible sensor is present. */
fun selectAutomaticH10Device(devices: List<H10Device>): H10Device? {
    val polarDevices = devices.filter { device ->
        device.name.contains("polar", ignoreCase = true) ||
            device.name.contains("h10", ignoreCase = true)
    }
    return polarDevices.singleOrNull() ?: devices.singleOrNull()
}
