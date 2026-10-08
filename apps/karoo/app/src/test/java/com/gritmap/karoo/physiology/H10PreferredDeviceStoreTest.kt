package com.gritmap.karoo.physiology

import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
class H10PreferredDeviceStoreTest {
    @Test
    fun `persists normalized address locally and clears it`() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val store = H10PreferredDeviceStore(context)
        store.clear()

        store.saveAddress("aa:bb:cc:dd:ee:ff")
        assertEquals("AA:BB:CC:DD:EE:FF", H10PreferredDeviceStore(context).loadAddress())

        store.clear()
        assertNull(store.loadAddress())
    }

    @Test(expected = IllegalArgumentException::class)
    fun `rejects malformed addresses`() {
        H10PreferredDeviceStore(
            ApplicationProvider.getApplicationContext(),
        ).saveAddress("not-an-address")
    }
}
