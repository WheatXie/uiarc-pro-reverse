# Editors

## `avatar-upload` · Avatar upload (Pro, component)

Click or drop a photo onto the avatar to crop it in place with drag, pinch and zoom. It uploads through a progress ring and settles, with clear errors and retry.

When to use:
- Profile, account and team member settings where a person sets their own photo.
- Workspace or organization logos that display in a circle.

When not to use:
- Several files or documents at once: use file-dropzone.
- Free form crops with aspect ratios, rotation or a large canvas: use image-cropper.

Keywords: input, upload, image, new, avatar upload, profile photo, profile picture, photo upload, image upload, crop, circular crop, zoom, pinch, drag and drop, progress ring, upload progress, initials, account settings, change photo

Files: avatar-upload.module.css, avatar-upload.tsx, demo.module.css, demo.tsx

## `file-dropzone` · File dropzone (Free, component)

A generous target for dropping one or more files.

When to use:
- Attachments and uploads with drag and drop plus a file picker.
- Uploads that need per-file progress, retry, and cancel through onUpload.

When not to use:
- Use input with type file only when a native picker with no list is enough.
- Use empty-state when the drop area is the only thing on an empty page and needs a larger call to action.

Keywords: field, files, react file upload, file dropzone, drag and drop upload, upload with progress, file uploader, dropzone component, multi file upload

Files: registry/components/file-dropzone/file-dropzone.tsx, registry/components/file-dropzone/file-dropzone.module.css

## `rich-text-editor` · Rich text editor (Free, component)

A lightweight editor with markdown shortcuts, a floating toolbar, a slash menu, and HTML and markdown output.

When to use:
- Comments, notes, and posts where people expect markdown shortcuts and a selection toolbar.
- Forms that need Markdown or clean HTML out without pulling in a full editor framework.

When not to use:
- Use textarea for plain text, or mention-input when the only rich part is tagging people.
- Use inline-edit for a single line edited in place.

Keywords: inputs, new, react rich text editor, markdown editor, wysiwyg editor, slash command menu, floating formatting toolbar, contenteditable editor, notion style editor, lightweight text editor

Files: registry/components/rich-text-editor/rich-text-editor.tsx, registry/components/rich-text-editor/rich-text-editor.module.css

## `signature-pad` · Signature pad (Free, component)

Smooth ink that thins with speed, with undo, replay, and PNG or SVG export.

When to use:
- Contracts, delivery confirmations, and consent forms that need a drawn signature.
- Initials or quick sketches where pen pressure and natural stroke width matter.

When not to use:
- Use input for a typed name when a legal drawn signature is not required.
- Use file-upload when the user already has a scanned signature image.

Keywords: inputs, new, react signature pad, signature capture, draw signature, e-signature field, pressure sensitive ink, signature to png, sign here component

Files: registry/components/signature-pad/signature-pad.tsx, registry/components/signature-pad/signature-pad.module.css
