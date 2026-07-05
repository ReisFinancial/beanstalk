import { useEffect } from 'react'
import { usePlanner } from '../context/PlannerContext.jsx'
import { computeSeason, unlocksFromMilestones, dailyVisitReward } from '../utils/room.js'

/**
 * Runs the "you opened the Room today" side effects: advances the visit
 * streak, grants the always-available daily cosmetic reward, reassesses
 * the season, and applies any newly-reached milestones.
 *
 * Call unconditionally from the top of Room.jsx. Every check here reads
 * from persisted profile state rather than local component state, so
 * repeated mounts/re-renders on the same day (including the extra renders
 * this effect itself triggers by updating the profile) are safe no-ops —
 * nothing is granted twice.
 */
export function useRoomVisit() {
  const { profile, recordVisit, updateSection, unlockRoomItem, addCarePoints } = usePlanner()

  useEffect(() => {
    if (!profile) return

    const today = new Date().toISOString().slice(0, 10)
    const alreadyVisitedToday = profile.room?.streak?.lastVisitDate === today
    recordVisit()

    if (!alreadyVisitedToday) {
      const reward = dailyVisitReward()
      unlockRoomItem(reward.item)
      addCarePoints(reward.carePoints)
    }

    const nextSeason = computeSeason(profile)
    if (nextSeason !== profile.room?.season) {
      updateSection('room', { season: nextSeason })
    }

    const { events, milestones } = unlocksFromMilestones(profile)
    if (events.length > 0) {
      for (const event of events) {
        unlockRoomItem(event.item)
        if (event.carePoints) addCarePoints(event.carePoints)
      }
      updateSection('room', { milestones })
    }
  }, [profile, recordVisit, updateSection, unlockRoomItem, addCarePoints])
}
