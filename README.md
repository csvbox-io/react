# @csvbox/react

> React adapter for csvbox.io

[![NPM](https://img.shields.io/npm/v/@csvbox/react.svg)](https://www.npmjs.com/package/@csvbox/react) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Shell

```bash
npm install @csvbox/react
```

## Import
```js
import { CSVBoxButton } from '@csvbox/react'
```

## Usage

```jsx
<CSVBoxButton
  licenseKey="Sheet license key"
  user={{
    user_id: "default123"
  }}
  onImport={(result, data) => {
    if(result){
      console.log("success");
      console.log(data.row_success + " rows uploaded");
      //custom code
    }else{
      console.log("fail");
      //custom code
    }
  }}
>
  Import
</CSVBoxButton>
```

## Importing a file you already have

`openModalWithFile(file)` opens the importer on a `File` your own page is holding — from your
own drop target, your own file input, anything — instead of the importer's file picker. The
file still goes through the importer's extension, worksheet and size checks; this skips the
picker, not the validation.

Through a ref:

```jsx
const importer = useRef(null)

<CSVBoxButton ref={importer} licenseKey="Sheet license key" user={{ user_id: "default123" }} onImport={onImport}>
  Import
</CSVBoxButton>

<input type="file" onChange={(e) => importer.current.openModalWithFile(e.target.files[0])} />
```

Or from the `render` prop, which is handed the same function as its third argument:

```jsx
<CSVBoxButton
  licenseKey="Sheet license key"
  user={{ user_id: "default123" }}
  onImport={onImport}
  render={(launch, isLoading, launchWithFile) => (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        launchWithFile(e.dataTransfer.files[0])
      }}
    >
      Drop a spreadsheet here, or <button disabled={isLoading} onClick={launch}>browse</button>
    </div>
  )}
/>
```

The importer can decline a file it is handed, and says why in a console warning
(`[csvbox] importer declined the supplied file: <reason>`):

- `import-in-progress` — the importer is open past its upload step, or is still reading an
  earlier file. An import that is already open stays open.
- `modal-closing` — the importer was closing when the file arrived.
- `import-file-url-configured` — the sheet is set up to load its own file from a URL.

Pass a `File`, not a `Blob`: a `Blob` has no name to read an extension from, and anything that
is not a `File` is ignored.

When the importer redirects to another host (data-location sheets do this), the file is sent to the host the importer actually ended up on, as long as that host is your importer domain or `<region>-<your domain>` (for example `eu-app.csvbox.io` for `app.csvbox.io`). A file is never sent to any other host.

If the importer does not answer a supplied file within about 8 seconds (for example because it redirected to a host that does not follow that naming, or it is too old to know the message), the importer is put away, the other buttons are enabled again, and the console says `[csvbox] the importer did not respond to the supplied file`.

## Several importers on one page

While an importer is open (or still loading to open), the button of every other CSVBox instance on the page is disabled until it closes, so two importers are not opened by accident. In React, the second argument of the `render` prop (`isLoading`) is also `true` in that state, so a custom trigger can disable itself the same way.

Opening a second importer from code (`openModal()` or `openModalWithFile()`) is still possible. The importer opened last is shown on top of the others, and closing it reveals the one underneath.

## Closing the importer during an import

If your user submits a file and then closes the importer before the import has finished, the import carries on and your `onImport` callback is still called with the result when it completes. The importer is reloaded the next time it is opened.

## Readme

For usage see the guide here - https://help.csvbox.io/getting-started#2-install-code


## License

MIT © [csvbox-io](https://github.com/csvbox-io)
