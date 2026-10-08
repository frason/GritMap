package com.gritmap.karoo.service

import android.content.Intent
import org.junit.Assert.assertNotNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [31])
class LiveSegmentServiceBindingTest {
    @Test
    fun `bound extension can create service without a start command`() {
        val controller = Robolectric.buildService(LiveSegmentService::class.java).create()
        try {
            assertNotNull(controller.get().onBind(Intent()))
        } finally {
            controller.destroy()
        }
    }
}
