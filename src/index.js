import React, { Component } from 'react';
import { version } from '../package.json';
import {
	HOLDER_STYLE,
	IFRAME_STYLE,
	buildImportUrl,
	generateUuid,
	buildInitPayload,
	createModalLifecycle,
	classifyStructuredMessage,
	classifyLegacyMessage
} from '@csvbox/adapter';

export class CSVBoxButton extends Component {

	constructor(props) {
		super(props);
		this.holder = React.createRef();
		this.openModal = this.openModal.bind(this);
		this.lifecycle = createModalLifecycle();
		this.uuid = generateUuid();
		this.state = {
			isLoading: true
		};
		this.iframe = null;
	}

	componentDidMount() {
		const { lazy } = this.props;
		if (!lazy && !this.iframe) {
			this.initImporter();
		} else if (lazy) {
			this.enableInitiator();
		}
	}

	initImporter() {
		const {
			loadStarted, user, dynamicColumns, options, onReady, onImport,
			onSubmit, onClose, licenseKey, dataLocation, customDomain,
			language, environment, theme
		} = this.props;

		loadStarted?.();

		const iframeUrl = buildImportUrl(
			{ licenseKey, customDomain, dataLocation, language, theme, environment },
			"react",
			version
		);

		const handleModalClosed = () => {
			if (this.holder.current) {
				this.holder.current.style.display = 'none';
				this.holder.current.innerHTML = '';
			}
			this.lifecycle.markClosed();
			this.iframe = null;
			onClose?.();
		};

		if (this.messageListener) {
			window.removeEventListener("message", this.messageListener, false);
		}

		this.messageListener = (event) => {
			const legacy = classifyLegacyMessage(event.data);
			if (legacy) {
				if (legacy.type === "mainModalHidden") {
					handleModalClosed();
				}
				if (legacy.type === "uploadSuccessful") {
					onImport(true);
				}
				if (legacy.type === "uploadFailed") {
					onImport(false);
				}
				return;
			}

			const message = classifyStructuredMessage(event.data, this.uuid);
			if (!message) {
				return;
			}

			if (message.type === "data-on-submit") {
				onSubmit?.(message.metadata);
			} else if (message.type === "data-push-status") {
				onImport(message.success, message.metadata);
			} else if (message.type === "csvbox-modal-hidden") {
				handleModalClosed();
			} else if (message.type === "csvbox-upload-successful") {
				onImport(true);
			} else if (message.type === "csvbox-upload-failed") {
				onImport(false);
			}
		};

		window.addEventListener("message", this.messageListener, false);

		this.uuid = generateUuid();

		const iframe = document.createElement("iframe");
		this.iframe = iframe;
		iframe.setAttribute("src", iframeUrl);
		iframe.setAttribute("allow", "clipboard-read; clipboard-write *");
		iframe.frameBorder = 0;
		iframe.classList.add('csvbox-iframe');
		Object.assign(iframe.style, IFRAME_STYLE);

		iframe.onload = () => {
			this.enableInitiator();
			iframe.contentWindow.postMessage(buildInitPayload(user, dynamicColumns, options, this.uuid), "*");
			onReady?.();
			if (this.lifecycle.markReady()) {
				this.openModal();
			}
		};

		this.holder.current.appendChild(iframe);
	}

	openModal() {
		if (!this.iframe) {
			this.lifecycle.requestOpen();
			this.initImporter();
			return;
		}

		if (this.lifecycle.requestOpen()) {
			this.iframe.contentWindow.postMessage('openModal', '*');
			this.holder.current.style.display = 'block';
		}
	}

	enableInitiator() {
		this.setState({
			isLoading: false
		});
	}

	render() {
		if (this.props.render) {
			return (
				<div>
					{this.props.render(this.openModal, this.state.isLoading)}
					<div ref={this.holder} style={HOLDER_STYLE}></div>
				</div>
			)
		}

		return (
			<div>
				<button disabled={this.state.isLoading} onClick={this.openModal} data-csvbox-initator data-csvbox-token={this.uuid}>{this.props.children}</button>
				<div ref={this.holder} style={HOLDER_STYLE}></div>
			</div>
		)
	}
}

export default CSVBoxButton;
