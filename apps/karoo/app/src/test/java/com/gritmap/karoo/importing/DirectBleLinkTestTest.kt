package com.gritmap.karoo.importing

import com.gritmap.karoo.BuildConfig
import org.junit.Assert.*
import org.junit.Test

class DirectBleLinkTestTest {
    @Test fun `normal build cannot inject a link drop`() {
        assertEquals(0, BuildConfig.BLE_TEST_DISCONNECT_AFTER_BYTES)
        assertFalse(DirectBleLinkTest().afterChunk(DirectTransferResourceName.SEGMENT, 524288))
    }

    @Test fun `diagnostic drop occurs once after complete segment chunks`() {
        val test = DirectBleLinkTest(8192)
        assertFalse(test.afterChunk(DirectTransferResourceName.SEGMENT, 7680))
        assertFalse(test.afterChunk(DirectTransferResourceName.PLAN, 9000))
        assertFalse(test.afterChunk(DirectTransferResourceName.RIDER, 9000))
        assertTrue(test.afterChunk(DirectTransferResourceName.SEGMENT, 8192))
        assertFalse(test.afterChunk(DirectTransferResourceName.SEGMENT, 8704))
        assertFalse(test.afterChunk(DirectTransferResourceName.SEGMENT, 8192))
    }
}
