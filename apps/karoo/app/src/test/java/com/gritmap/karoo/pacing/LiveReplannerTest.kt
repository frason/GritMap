package com.gritmap.karoo.pacing

import org.junit.Assert.*
import org.junit.Test
import kotlinx.serialization.json.*
import java.io.File

class LiveReplannerTest {
    private val p = ReplanParameters(criticalPowerWatts = 250.0, wPrimeJoules = 20000.0,
        wPrimeReserveFraction = .15, maxStepWatts = 20, hardMaxStepWatts = 80, stepLimitMinGradePct = 1.5)
    private fun sections(ceiling: Int = 270) = listOf(8.0, 7.0, 3.0, 2.0).mapIndexed { i, grade ->
        ReplanSection(i * 402.336, (i + 1) * 402.336, 250, ceiling, grade)
    }
    private fun replan(elapsed: Double, ceiling: Int = 270, parameters: ReplanParameters? = p,
        balance: Double = 20000.0) = LiveReplanner.replan(sections(ceiling), 402.336, elapsed, 800, balance, parameters)

    @Test fun `behind distributes effort within ceilings and steps without altering completed section`() {
        val result = replan(220.0)
        assertEquals(250, result.targets.first())
        assertTrue(result.changed)
        assertTrue(result.targets.drop(1).all { it in 250..270 })
        assertTrue(result.targets.zipWithNext().all { kotlin.math.abs(it.first - it.second) <= 20 })
        assertTrue(result.estimatedFinishSeconds < 820.0)
    }
    @Test fun `ahead and deadband do not spend surplus`() {
        assertEquals(listOf(250,250,250,250), replan(180.0).targets)
        assertFalse(replan(202.0).changed)
    }
    @Test fun `unreachable goal reports estimate and never inflates ceiling`() {
        val result = replan(300.0, ceiling = 255)
        assertFalse(result.goalReachable)
        assertTrue(result.gapSeconds > 80)
        assertTrue(result.targets.all { it <= 255 })
    }
    @Test fun `legacy and unknown metadata cannot invent headroom`() {
        assertFalse(replan(240.0, parameters = null).changed)
    }
    @Test fun `low reserve forbids catch up above critical power`() {
        assertTrue(replan(250.0, balance = 3000.0).targets.all { it <= 250 })
    }
    @Test fun `downhill and missing grade receive no added power`() {
        val sections = sections().map { it.copy(gradePct = null) }
        assertFalse(LiveReplanner.replan(sections,402.336,240.0,800,20000.0,p).changed)
        assertFalse(LiveReplanner.replan(sections.map { it.copy(gradePct = -3.0) },402.336,240.0,800,20000.0,p).changed)
    }
    @Test fun `incompatible fixed past step and depleted reserve withholds adjustments`() {
        val s = sections(320).map { it.copy(targetWatts=300) }
        val result = LiveReplanner.replan(s,402.336,220.0,800,3000.0,p)
        assertTrue(result.constraintConflict)
        assertFalse(result.changed)
        assertFalse(result.goalReachable)
    }
    @Test fun `shared synthetic replay has exact bounded targets and estimated finish`() {
        val root = generateSequence(File(".").absoluteFile) { it.parentFile }.first { File(it,"docs/fixtures/live-replan-synthetic.json").exists() }
        val f = Json.parseToJsonElement(File(root,"docs/fixtures/live-replan-synthetic.json").readText()).jsonObject
        val elapsed = 200.0 * 250 / f.getValue("firstSectionActualWatts").jsonPrimitive.int
        val result = replan(elapsed)
        assertEquals(f.getValue("boundaryElapsedSeconds").jsonPrimitive.double, elapsed, .00001)
        assertEquals(f.getValue("expectedTargets").jsonArray.map { it.jsonPrimitive.int }, result.targets)
        assertEquals(f.getValue("expectedEstimatedFinishSeconds").jsonPrimitive.double, result.estimatedFinishSeconds, .00001)
        assertEquals(f.getValue("expectedGoalReachableWithinDeadband").jsonPrimitive.boolean, result.goalReachable)
        File("/tmp/gritmap-replanner-synthetic-replay.txt").writeText("first section actual 230 W vs target 250 W; elapsed=$elapsed\n$result\n")
    }
    @Test fun `energy recovery matches phone differential ten second convention`() {
        val result = replanEnergyStep(10000.0,200.0,20.0,p)
        assertEquals(10493.75,result,.0001)
        assertEquals(10000.0,replanEnergyStep(10000.0,250.0,20.0,p),.0001)
        assertEquals(9000.0,replanEnergyStep(10000.0,300.0,20.0,p),.0001)
    }
    @Test fun `synthetic twenty watt shortfall replay adapts at later boundary`() {
        val s = sections()
        val times = listOf(0.0, 218.0, 418.0, 618.0)
        for (i in 1..3) {
            val result = LiveReplanner.replan(s, s[i].startMeters, times[i],800,20000.0,p)
            assertEquals(s.take(i).map { it.targetWatts }, result.targets.take(i))
            assertTrue(result.targets.all { it <= 270 })
            assertTrue(result.targets.zipWithNext().all { kotlin.math.abs(it.first-it.second) <= 20 })
        }
    }
}
