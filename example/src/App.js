import React from 'react'

import { CSVBoxButton } from '@csvbox/react'

const App = () => {
  return <CSVBoxButton licenseKey="Sheet license key" user={{
    user_id: "default123"
  }}
  onReady={() => {
    console.log("onReady");
  }}
  onClose={() => {
    console.log("onClose");
  }}
  onSubmit={(data) => {
    console.log("onSubmit");
    console.log(data);
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
