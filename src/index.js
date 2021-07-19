import React, { Component } from 'react';
import styles from './styles.module.css'

export class CSVBoxButton extends Component {

  constructor(props) {
    super(props)
    this.holder = React.createRef();
    this.iframe = React.createRef();
    this.openModal = this.openModal.bind(this)
    this.isModalShown = false;
  }

  componentDidMount() {
    const { onImport } = this.props;
    const {user} = this.props;
    window.addEventListener("message", (event) => {
      if (event.data === "mainModalHidden") {
          this.holder.current.style.display = 'none';
          this.holder.current.querySelector('iframe').src = this.holder.current.querySelector('iframe').src;
          this.isModalShown = false;
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
    iframe.onload = function () {
      if(user){
        iframe.contentWindow.postMessage({
          "customer" : user
        }, "*");
      }
    }
  }
  openModal() {
    if(!this.isModalShown) {
      this.isModalShown = true;
      this.iframe.current.contentWindow.postMessage('openModal', '*');
      this.holder.current.style.display = 'block';
    }
  }
  render() {
    const { licenseKey } = this.props;
    let iframeSrc = "https://app.csvbox.io/embed/" + licenseKey;
    return (
      <div>
        <button onClick={this.openModal}>{this.props.children}</button>
        <div ref={this.holder} className={styles.holder} style={{ display: 'none' }}>
          <iframe ref={this.iframe} className={styles.iframe} src={ iframeSrc } frameBorder="0" ></iframe>
        </div>
      </div>
    )
  }
}

export default CSVBoxButton;
