import React, { Component } from 'react';
// import styles from './styles.module.css'
import { version } from '../package.json';

export class CSVBoxButton extends Component {

  constructor(props) {
    super(props)
    this.holder = React.createRef();
    this.openModal = this.openModal.bind(this)
    this.openModalWithFile = this.openModalWithFile.bind(this)
    this.isModalShown = false;
    this.shouldOpenModalOnReady = false;
    this.pendingFile = null;
    this.uuid = this.generateUuid();
    this.state = {
      isLoading: true
    };
    this.iframe = null;
  }

  componentDidMount() {
    const { lazy } = this.props;
    if(!lazy && !this.iframe) {
      this.initImporter();
    }else if(lazy) {
      this.enableInitator();
    }
  }

  initImporter() {

    const { loadStarted } = this.props;

    loadStarted?.();

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
    const { environment } = this.props;
    const { theme } = this.props;

    let domain = customDomain ? customDomain : "app.csvbox.io";

    if(dataLocation) {
      domain = `${dataLocation}-${domain}`;
    }

    // Only postPendingFile() uses this. The config messages keep their "*" target: narrowing
    // those would silently drop the handshake for any customDomain that redirects to another
    // host, and breaking existing importers is not worth it. A file is different — its bytes
    // are the end user's, so they go to a named origin or nowhere.
    this.targetOrigin = `https://${domain}`;

    let iframeUrl = `https://${domain}/embed/${licenseKey}`;

    iframeUrl += `?library-version=${version}`;
    iframeUrl += "&framework=react";

    if(dataLocation) {
      iframeUrl += "&preventRedirect";
    }

    if(language) {
      iframeUrl += "&language=" + language;
    }

    if(theme) {
      iframeUrl += "&theme=" + theme;
    }

    if(environment) {
      let env = JSON.stringify(environment).replace(/['"]/g, function(match) {
        return '\\' + match;
      });
      iframeUrl += `&env=${env}`;
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
            if(event.data.data.import_status == "success") {
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
                    row_data.data?.forEach((col, i) => {
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
                metadata["column_mappings"] = event.data.column_mapping;
                metadata["raw_columns"] = event.data.raw_columns;
                metadata["ignored_columns"] = event.data.ignored_column_row;
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
          } else if(event.data.type && event.data.type == "csvbox-modal-shown") {
            // What the file path in openModal() is waiting for. display as well as
            // pointer-events: a second file declined while the first was still opening the
            // modal has put the holder away in the meantime.
            this.isModalShown = true;
            if (this.holder && this.holder.current) {
              this.holder.current.style.display = 'block';
              this.holder.current.style.pointerEvents = 'auto';
            };
          } else if(event.data.type && event.data.type == "csvbox-set-file-rejected") {
            // The importer has the file and will not take it. Put the holder away only if the
            // modal was never confirmed up: a file declined while it is open (an import past
            // the upload step, a fade-out under way) leaves that modal where it is, and its
            // own 'csvbox-modal-hidden' will put the holder away when it closes.
            if (!this.isModalShown && this.holder && this.holder.current) {
              this.holder.current.style.display = 'none';
              this.holder.current.style.pointerEvents = 'auto';
            };
            console.warn("[csvbox] importer declined the supplied file: " + event.data.data.reason);
          } else if(event.data.type && event.data.type == "csvbox-modal-hidden") {
            if (this.holder && this.holder.current) {
              this.holder.current.style.display = 'none';
              this.holder.current.style.pointerEvents = 'auto';
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
    iframe.setAttribute("allow", "clipboard-read; clipboard-write *");
    iframe.frameBorder = 0;
    iframe.classList.add('csvbox-iframe');

    iframe.style.height = "100%";
    iframe.style.width = "100%";
    iframe.style.position = "absolute";
    iframe.style.top = "0px";
    iframe.style.left = "0px";

    window.addEventListener("message", this.onMessageEvent, false);

    iframe.onload = function () {
      iframe.contentWindow.postMessage({
        "customer" : user ? user : null,
        "columns" : dynamicColumns ? dynamicColumns : null,
        "options" : options ? options : null,
        "unique_token": self.uuid
      }, "*");
      onReady?.();
      // The deferred open waits for the state update to land. React 18+ batches setState
      // outside its own event handlers too, so called straight after enableInitator()
      // openModal() still saw isLoading and deferred itself again -- and the flag was then
      // cleared, dropping the open (and any pending file) on the floor.
      self.enableInitator(() => {
        if(self.shouldOpenModalOnReady) {
          self.shouldOpenModalOnReady = false;
          self.openModal();
        }
      });
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
        if(this.pendingFile) {
          // The importer opens its own modal once it has the file, so that it can inject on
          // 'shown.bs.modal'. Sending 'openModal' as well would race that.
          //
          // It can also decline: wrong step, an import file URL configured on the sheet, or
          // an importer too old to know the message at all. So the holder goes up
          // click-through and stays that way until 'csvbox-modal-shown' confirms the modal
          // is really up. It covers the viewport at z-index 2147483647 and the importer
          // renders transparent with its modal closed, so arming it on an unanswered message
          // leaves an invisible sheet over the host page eating every click.
          //
          // display:block regardless, so the iframe lays out and animates normally; only
          // pointer-events is held back. isModalShown likewise waits for the confirmation,
          // or a declined file would latch the importer shut for good.
          this.holder.current.style.pointerEvents = 'none';
          this.holder.current.style.display = 'block';
          this.postPendingFile();
        } else {
          this.isModalShown = true;
          this.iframe.contentWindow.postMessage('openModal', '*');
          // Explicit: a previously declined file leaves the holder click-through.
          this.holder.current.style.pointerEvents = 'auto';
          this.holder.current.style.display = 'block';
        }
      } else {
        this.shouldOpenModalOnReady = true;
      }
    }

  }

  /**
   * Open the importer on a File the host page already has, instead of the file picker.
   *
   * Reachable two ways: a ref on the component (`ref.current.openModalWithFile(file)`), or
   * the third argument handed to the `render` prop.
   *
   * The File crosses to the iframe by structured clone, so the importer receives the real
   * object and applies its own extension, worksheet and size rules to it — this does not
   * bypass any of them. Pass a File; a Blob has no name for the importer to read an
   * extension from.
   */
  openModalWithFile(file) {

    // window.File, not a bare File: eslint-config-standard declares only window, document
    // and navigator as browser globals, so a bare File is a no-undef error here.
    if(!window.File || !(file instanceof window.File)) {
      return;
    }

    this.pendingFile = file;

    // Already open: hand it over now rather than holding it for the next open. The importer
    // takes it only while it is still on the upload step, and ignores it once the user has a
    // dataset and a mapping in progress.
    if(this.isModalShown && this.iframe && !this.state.isLoading) {
      this.postPendingFile();
      return;
    }

    this.openModal();
  }

  postPendingFile() {
    this.iframe.contentWindow.postMessage({
      type: 'csvbox-set-file',
      file: this.pendingFile,
      unique_token: this.uuid
    }, this.targetOrigin);
    this.pendingFile = null;
  }

  generateUuid() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  enableInitator(callback) {
    this.setState({
      isLoading: false
    }, callback)
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
          {this.props.render(this.openModal, this.state.isLoading, this.openModalWithFile)}
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
