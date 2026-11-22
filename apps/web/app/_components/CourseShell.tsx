import { Stack } from '@polski/ui'
import { SectionNav } from './SectionNav'
import { TabBody } from './TabBody'

export function CourseShell({ children, current }: {
  children: React.ReactNode
  current: '/program' | '/progress'
}) {
  return (
    <TabBody controls={<SectionNav section="course" current={current} />}>
      <Stack gap="lg">{children}</Stack>
    </TabBody>
  )
}
