import { CommentThread } from './CommentThread'

export function CommentThreadDemo() {
  return (
    <div className="flex w-full items-center justify-center py-14">
      <CommentThread
        initialDraft="Looks great, ship it"
        initialPickerOpen={new URLSearchParams(window.location.search).get('picker') === '1'}
      />
    </div>
  )
}
