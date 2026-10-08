package com.gritmap.karoo.physiology

import android.content.Context

/** App-private, no-backup identity required to reconnect when an H10 is not advertising. */
class H10PreferredDeviceStore(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun loadAddress(): String? = preferences.getString(KEY_ADDRESS, null)

    fun saveAddress(address: String) {
        require(BLUETOOTH_ADDRESS.matches(address)) { "Invalid Bluetooth device address" }
        preferences.edit().putString(KEY_ADDRESS, address.uppercase()).apply()
    }

    fun clear() {
        preferences.edit().remove(KEY_ADDRESS).apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "h10_preferred_device"
        const val KEY_ADDRESS = "address"
        val BLUETOOTH_ADDRESS = Regex("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}")
    }
}
