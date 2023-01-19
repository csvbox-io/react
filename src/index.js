import React, { Component } from 'react';
// import styles from './styles.module.css'
import { version } from '../package.json';

export class CSVBoxButton extends Component {

  constructor(props) {
    super(props)
    this.holder = React.createRef();
    // this.iframe = React.createRef();
    this.openModal = this.openModal.bind(this)
    this.isModalShown = false;
    this.shouldOpenModalOnReady = false;
    this.uuid = this.generateUuid();
    this.state = {
      isLoading: true,
      firstLoad: true, //For React v18's componentDidMount fix
    };
    this.iframe = null;
  }

  componentDidMount() {
    const { lazy } = this.props;
    if(this.state.firstLoad) {
      this.setState({ firstLoad: false })
      if(lazy) {
        this.enableInitator();
      } else {
          this.initImporter();
      }
    }
  }

  initImporter() {

    const { user } = this.props;
    const { dynamicColumns } = this.props;
    const { options } = this.props;
    const { onReady } = this.props;
    const { onImport } = this.props;
    const { onSubmit } = this.props;
    const { onClose } = this.props;
    const { licenseKey } = this.props;
    const { dataLocation } = this.props;
    const { customDomain } = this.props;
    const { language } = this.props;

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

    if(language) {
      iframeUrl += "&language=" + language;
    }

    window.addEventListener("message", (event) => {

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

    let self = this;

    let iframe = document.createElement("iframe");
    this.iframe = iframe;
    iframe.setAttribute("src", iframeUrl);
    iframe.frameBorder = 0;
    iframe.classList.add('csvbox-iframe');

    iframe.style.height = "100%";
    iframe.style.width = "100%";
    iframe.style.position = "absolute";
    iframe.style.top = "0px";
    iframe.style.left = "0px";

    window.addEventListener("message", this.onMessageEvent, false);

    iframe.onload = function () {
      self.enableInitator();
      iframe.contentWindow.postMessage({
        "customer" : user ? user : null,
        "columns" : dynamicColumns ? dynamicColumns : null,
        "options" : options ? options : null,
        "unique_token": self.uuid
      }, "*");
      onReady?.();
      if(self.shouldOpenModalOnReady) {
        self.openModal();
        self.shouldOpenModalOnReady = false;
      }
    }
    this.holder.current.appendChild(iframe);
  }

  openModal() {

    const { lazy } = this.props;

    if(lazy) {
      if(!this.iframe) {
          this.shouldOpenModalOnReady = true;
          this.initImporter();
          return;
      }
    }

    if(!this.isModalShown) {
      if(!this.state.isLoading) {
        this.isModalShown = true;
        this.iframe.contentWindow.postMessage('openModal', '*');
        this.holder.current.style.display = 'block';
      } else {
        this.shouldOpenModalOnReady = true;
      }
    }

  }

  generateUuid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  enableInitator() {
    this.setState({
      isLoading: false
    })
  }

  render() {

    const holderStyle = {
      display: "none",
      zIndex: 2147483647,
      position: "fixed",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    };

    if(this.props.render) {
      return (
        <div>
          {this.props.render(this.openModal, this.state.isLoading)}
          <div ref={this.holder} style={holderStyle}></div>
        </div>
      )
    }else{
      return (
        <div>
          <button disabled={this.state.isLoading} onClick={this.openModal} data-csvbox-initator data-csvbox-token={this.uuid}>{this.props.children}</button>
          <div ref={this.holder} style={holderStyle}></div>
        </div>
      )
    }


  }
}

export default CSVBoxButton;
