package com.gritmap.karoo.pacing

import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import kotlin.math.abs

class ShapeReplayTest {
    @Test fun `synthetic short rolling and long climb replays preserve bounds and completed work`() {
        val root=generateSequence(File(".").absoluteFile) { it.parentFile }.first { File(it,"fixtures/contracts/replanner-shapes-v1.json").exists() }
        val shapes=Json.parseToJsonElement(File(root,"fixtures/contracts/replanner-shapes-v1.json").readText()).jsonObject.getValue("shapes").jsonArray
        val p=ReplanParameters(criticalPowerWatts=250.0,wPrimeJoules=20000.0,wPrimeReserveFraction=.15,maxStepWatts=20,hardMaxStepWatts=80,stepLimitMinGradePct=1.5)
        for (item in shapes) {
            val shape=item.jsonObject
            val grades=shape.getValue("grades").jsonArray.map { it.jsonPrimitive.double }
            val target=shape.getValue("targetWatts").jsonPrimitive.int
            val ceiling=shape.getValue("ceilingWatts").jsonPrimitive.int
            val seconds=shape.getValue("secondsPerSection").jsonPrimitive.int
            val sections=grades.mapIndexed { i,g -> ReplanSection(i*402.336,(i+1)*402.336,target,ceiling,g) }
            val goal=seconds*sections.size
            // 20 W shortfall in the first section, then target power, at every later boundary.
            for (boundary in 1 until sections.size) {
                val elapsed=seconds*target.toDouble()/(target-20)+(boundary-1)*seconds
                val r=LiveReplanner.replan(sections,sections[boundary].startMeters,elapsed,goal,20000.0,p)
                assertEquals(sections.take(boundary).map { it.targetWatts },r.targets.take(boundary))
                assertTrue(r.targets.all { it in target..ceiling })
                assertTrue(r.targets.zipWithNext().all { abs(it.first-it.second)<=20 })
                assertTrue(r.changed)
                assertTrue(r.estimatedFinishSeconds < elapsed+(sections.size-boundary)*seconds)
                val ahead=LiveReplanner.replan(sections,sections[boundary].startMeters,boundary*seconds-10.0,goal,20000.0,p)
                assertEquals(sections.map { it.targetWatts },ahead.targets)
                val unreachable=LiveReplanner.replan(sections,sections[boundary].startMeters,boundary*seconds+goal.toDouble(),goal,20000.0,p)
                assertFalse(unreachable.goalReachable)
                assertTrue(unreachable.gapSeconds>0)
                assertTrue(unreachable.estimatedFinishSeconds.isFinite())
                assertTrue(unreachable.targets.all { it<=ceiling })
                assertTrue(unreachable.targets.zipWithNext().all { abs(it.first-it.second)<=20 })
            }
        }
    }
}
