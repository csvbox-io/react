import React, { Component } from 'react';
// import styles from './styles.module.css'

import { version } from '../package.json';

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
    const { onReady } = this.props;
    const { onSubmit } = this.props;
    const { onClose } = this.props;

    window.addEventListener("message", (event) => {

      // console.log("message", event);

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

        if(event?.data?.data?.unique_token == this.uuid) {

          if(event.data.type && event.data.type == "data-on-submit") {
            let metadata = event.data.data;
            metadata["column_mappings"] = event.data.column_mapping;
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
                let virtual_columns_indexes = event.data.virtualColumnsIndexes || [];

                let dropdown_display_labels_mappings = event.data.dropdown_display_labels_mappings;
                primary_row_data.forEach((row_data) => {
                    let x = {};
                    let dynamic_columns = {};
                    let virtual_data = {};
                    row_data.data.forEach((col, i)=>{
                        if(col == undefined){ col = "" }
                        if(!!dropdown_display_labels_mappings[i] && !!dropdown_display_labels_mappings[i][col]) {
                            col = dropdown_display_labels_mappings[i][col];
                        }
                        if(dynamic_columns_indexes.includes(i)) {
                          dynamic_columns[headers[i]] = col;
                        }
                        else if(virtual_columns_indexes.includes(i)) {
                          virtual_data[headers[i]] = col;
                        }
                        else{
                            x[headers[i]] = col;
                        }
                    });
                    if(row_data.unmapped_data) {
                      x["_unmapped_data"] = row_data.unmapped_data;
                    }
                    if(dynamic_columns && Object.keys(dynamic_columns).length > 0) {
                      x["_dynamic_data"] = dynamic_columns;
                    }
                    if(virtual_data && Object.keys(virtual_data).length > 0) {
                      x["_virtual_data"] = virtual_data;
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
          } else if(event.data.type && event.data.type == "csvbox-modal-hidden") {
            if (this.holder && this.holder.current) {
              this.holder.current.style.display = 'none';
            };
            this.isModalShown = false;
            onClose?.();
          } else if(event.data.type && event.data.type == "csvbox-upload-successful") {
            this.onImport?.(true);
          } else if(event.data.type && event.data.type == "csvbox-upload-failed") {
            this.onImport?.(false);
          }
        }


      }
    }, false);
    let iframe = this.iframe.current;

    let self = this;

    iframe.onload = function () {

      onReady?.();

      self.enableInitator();

      iframe.contentWindow.postMessage({
        "customer" : user ? user : null,
        "columns" : dynamicColumns ? dynamicColumns : null,
        "options" : options ? options : null,
        "unique_token": self.uuid
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
    const { dataLocation } = this.props;
    const { customDomain } = this.props;

    let domain = customDomain ? customDomain : "app.csvbox.io";

    if(dataLocation) {
      domain = `${dataLocation}-${domain}`;
    }

    let iframeUrl = `https://${domain}/embed/${licenseKey}`;

    iframeUrl += `?library-version=${version}`;
    iframeUrl += "&framework=react";

    if(dataLocation) {
      iframeUrl += "&preventRedirect";
    }

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
          {this.props.render(this.openModal, !this.state.disabled)}
          <div ref={this.holder} style={holderStyle}>
            <iframe ref={this.iframe} style={iframeStyle} data-csvbox-token={this.uuid} src={iframeUrl} frameBorder="0" ></iframe>
          </div>
        </div>
      )
    }else{
      return (
        <div>
          <button disabled={this.state.disabled} onClick={this.openModal} data-csvbox-initator data-csvbox-token={this.uuid}>{this.props.children}</button>
          <div ref={this.holder} style={holderStyle}>
            <iframe ref={this.iframe} style={iframeStyle} data-csvbox-token={this.uuid} src={iframeUrl} frameBorder="0" ></iframe>
          </div>
        </div>
      )
    }


  }
}

export default CSVBoxButton;
