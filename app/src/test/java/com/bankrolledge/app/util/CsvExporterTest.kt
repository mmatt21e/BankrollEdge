package com.bankrolledge.app.util

import com.bankrolledge.app.data.local.entity.SessionEntity
import com.bankrolledge.app.data.model.SessionType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CsvExporterTest {

    @Test
    fun `csv includes header with profit column`() {
        val csv = CsvExporter.buildCsv(emptyList())
        val header = csv.lineSequence().first()
        assertTrue("header should contain Profit", header.split(',').contains("Profit"))
    }

    @Test
    fun `profit column carries net result`() {
        val csv = CsvExporter.buildCsv(
            listOf(
                SessionEntity(
                    sessionType = SessionType.CASH.name,
                    buyIn = 100.0,
                    rebuysAddons = 50.0,
                    cashOut = 400.0,
                    tips = 10.0, // profit = 400 - 150 - 10 = 240
                    startTime = 1_700_000_000_000,
                ),
            ),
        )
        val row = csv.trim().lineSequence().last().split(',')
        val header = csv.lineSequence().first().split(',')
        assertEquals("240.0", row[header.indexOf("Profit")])
    }

    @Test
    fun `fields with commas and quotes are escaped`() {
        val csv = CsvExporter.buildCsv(
            listOf(
                SessionEntity(
                    location = "Vegas, NV",
                    notes = "said \"nice hand\"",
                    startTime = 1_700_000_000_000,
                ),
            ),
        )
        assertTrue(csv.contains("\"Vegas, NV\""))
        assertTrue(csv.contains("\"said \"\"nice hand\"\"\""))
    }
}
