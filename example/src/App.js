import React from 'react'

import { CSVBoxButton } from '@csvbox/react'
import '@csvbox/react/dist/index.css'

const App = () => {
  return <CSVBoxButton licenseKey="Sheet license key" user={{
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
  >Import</CSVBoxButton>
}

export default App
