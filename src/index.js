import React, { Component } from 'react';
// import styles from './styles.module.css'

export class CSVBoxButton extends Component {

  constructor(props) {
    super(props)
    this.holder = React.createRef();
    this.iframe = React.createRef();
    this.openModal = this.openModal.bind(this)
    this.isModalShown = false;
    this.uuid = this.generateUuid();

    this.state = {
      disabled: true
    };

  }

  componentDidMount() {

    const { onImport } = this.props;
    const { user } = this.props;
    const { dynamicColumns } = this.props;
    const { options } = this.props;
    const { debugMode } = this.props;
    const { useStagingServer } = this.props;
    const { licenseKey } = this.props;

    const { onReady } = this.props;
    const { onSubmit } = this.props;
    const { onClose } = this.props;

    if(debugMode) {
      console.log(`[Csvbox-${this.uuid}]`,"UUID:", this.uuid);
      console.log(`[Csvbox-${this.uuid}]`,"License key:", licenseKey);
      console.log(`[Csvbox-${this.uuid}]`,`Using ${useStagingServer ? 'staging' : 'live'} server` );
    }

    window.addEventListener("message", (event) => {

      // if(debugMode) { console.log(`[Csvbox-${this.uuid}]`, "Message:", event); }

      if (event.data === "mainModalHidden") {
          if (this.holder && this.holder.current) {
            this.holder.current.style.display = 'none';
          };
          this.isModalShown = false;
          onClose?.();
      }
      if(event.data === "uploadSuccessful") {
        onImport(true);
      }
      if(event.data === "uploadFailed") {
        onImport(false);
      }
      if(typeof event.data == "object") {
        if(event.data.type && event.data.type == "data-on-submit") {
          let metadata = event.data.data;
          metadata["column_mappings"] = event.data.column_mapping;
          // this.callback(true, metadata);
          delete metadata["unique_token"];
          onSubmit?.(metadata);
      }
      else if(event.data.type && event.data.type == "data-push-status") {
          if(event.data.data.import_status = "success"){
            if(event.data && event.data.row_data) {
              let primary_row_data = event.data.row_data;
              let headers = event.data.headers;
              let rows = [];
              let dynamic_columns_indexes = event.data.dynamicColumnsIndexes;
              let dropdown_display_labels_mappings = event.data.dropdown_display_labels_mappings;
              primary_row_data.forEach((row_data) => {
                  let x = {};
                  let dynamic_columns = {};
                  row_data.data.forEach((col, i)=>{
                      if(col == undefined){ col = "" }
                      if(!!dropdown_display_labels_mappings[i] && !!dropdown_display_labels_mappings[i][col]) {
                          col = dropdown_display_labels_mappings[i][col];
                      }
                      if(dynamic_columns_indexes.includes(i)) {
                          dynamic_columns[headers[i]] = col;
                      }else{
                          x[headers[i]] = col;
                      }
                  });
                  if(row_data.unmapped_data) {
                      x["_unmapped_data"] = row_data.unmapped_data;
                  }
                  if(dynamic_columns && Object.keys(dynamic_columns).length > 0) {
                      x["_dynamic_data"] = dynamic_columns;
                  }
                  rows.push(x);
              });
              let metadata = event.data.data;
              metadata["rows"] = rows;
              delete metadata["unique_token"];
              onImport(true, metadata);
            }else{
              let metadata = event.data.data;
              delete metadata["unique_token"];
              onImport(true, metadata);
            }
          }else {
            onImport(false, event.data.data);
          }
        }
      }
    }, false);
    let iframe = this.iframe.current;

    let self = this;

    iframe.onload = function () {

      if(debugMode) { console.log(`[Csvbox-${self.uuid}]`,"iframe loaded"); }

      onReady?.();

      self.enableInitator();

      iframe.contentWindow.postMessage({
        "customer" : user ? user : null,
        "columns" : dynamicColumns ? dynamicColumns : null,
        "options" : options ? options : null,
        "unique_token": this.uuid
      }, "*");

    }
  }
  openModal() {
    if(!this.isModalShown) {
      this.isModalShown = true;
      this.iframe.current.contentWindow.postMessage('openModal', '*');
      this.holder.current.style.display = 'block';
    }
  }

  generateUuid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  enableInitator() {
    this.setState({
      disabled: !this.state.disabled
    })
  }

  render() {

    const { licenseKey } = this.props;
    const { useStagingServer } = this.props;

    let iframeSrc = `https://${useStagingServer ? 'staging' : 'app' }.csvbox.io/embed/${licenseKey}`;
    iframeSrc += "?library-version=2";

    const holderStyle = {
      display: "none",
      zIndex: 2147483647,
      position: "fixed",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };

    const iframeStyle = {
      height: "100%",
      width: "100%",
      position: "absolute",
      top: "0px",
      left: "0px"
    };

    if(this.props.render) {
      return (
        <div>
          {this.props.render(this.openModal)}
          <div ref={this.holder} style={holderStyle}>
            <iframe ref={this.iframe} style={iframeStyle} data-csvbox-token={this.uuid} src={ iframeSrc } frameBorder="0" ></iframe>
          </div>
        </div>
      )
    }else{
      return (
        <div>
          <button disabled={this.state.disabled} onClick={this.openModal} data-csvbox-initator data-csvbox-token={this.uuid}>{this.props.children}</button>
          <div ref={this.holder} style={holderStyle}>
            <iframe ref={this.iframe} style={iframeStyle} data-csvbox-token={this.uuid} src={iframeSrc} frameBorder="0" ></iframe>
          </div>
        </div>
      )
    }


  }
}

export default CSVBoxButton;
