package com.gritmap.karoo.karoo

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExtensionInfoTest {
    @Test
    fun `extension XML advertises every implemented field including experimental H10`() {
        val document = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(
            File("src/main/res/xml/karoo_extension_info.xml"),
        )
        val nodes = document.getElementsByTagName("DataType")
        val typeIds = (0 until nodes.length).map { index ->
            nodes.item(index).attributes.getNamedItem("typeId").nodeValue
        }.toSet()

        assertEquals(10, typeIds.size)
        assertTrue(H10CardiacDataType.TYPE_ID in typeIds)
        assertTrue(CardiacDriftDataType.TYPE_ID in typeIds)
        assertTrue(PacingCoachDataType.TYPE_ID in typeIds)
        assertTrue(PacingProfileDataType.TYPE_ID in typeIds)
        assertTrue(SegmentPerformanceDataType.TYPE_ID in typeIds)
        assertTrue(PowerBalanceDataType.TYPE_ID in typeIds)
        assertTrue(TargetPowerDataType.TYPE_ID in typeIds)
        assertTrue(PowerDeltaDataType.TYPE_ID in typeIds)
        assertTrue(PredictedFinishDataType.TYPE_ID in typeIds)
        assertTrue(WattsPerHeartRateDataType.TYPE_ID in typeIds)
    }
}
