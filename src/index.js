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
    const { onClose } = this.props;

    if(debugMode) {
      console.log(`[Csvbox-${this.uuid}]`,"UUID:", this.uuid);
      console.log(`[Csvbox-${this.uuid}]`,"License key:", licenseKey);
      console.log(`[Csvbox-${this.uuid}]`,`Using ${useStagingServer ? 'staging' : 'live'} server` );
    }

    window.addEventListener("message", (event) => {

      // if(debugMode) { console.log(`[Csvbox-${this.uuid}]`, "Message:", event); }

      if (event.data === "mainModalHidden") {
          this.holder.current.style.display = 'none';
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
        if(event.data.type && event.data.type == "data-push-status") {
          if(event.data.data.import_status = "success"){
            onImport(true, event.data.data);
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
