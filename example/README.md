# csvbox-react

> React adapter for csvbox.io

[![NPM](https://img.shields.io/npm/v/@csvbox/react.svg)](https://www.npmjs.com/package/@csvbox/react) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Shell

```bash
npm install @csvbox/react
```

## Import
```js
import { CSVBoxButton } from '@csvbox/react'
import '@csvbox/react/dist/index.css'
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

## Readme

For usage see the guide here - https://help.csvbox.io/getting-started#2-install-code


## License

MIT © [csvbox-io](https://github.com/csvbox-io)
