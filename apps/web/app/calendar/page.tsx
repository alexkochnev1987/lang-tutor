import { CourseShell } from '../_components/CourseShell'
import { CalendarWorkspace } from './CalendarWorkspace'

export default function CalendarPage() {
  return (
    <CourseShell current="/calendar">
      <CalendarWorkspace />
    </CourseShell>
  )
}
