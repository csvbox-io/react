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

// How long we wait for the importer to reply before sending the file anyway.
const ORIGIN_PROBE_TIMEOUT_MS = 1500;

export class CSVBoxButton extends Component {

	constructor(props) {
		super(props);
		this.holder = React.createRef();
		this.openModal = this.openModal.bind(this);
		this.openModalWithFile = this.openModalWithFile.bind(this);
		this.lifecycle = createModalLifecycle();
		this.isModalShown = false;
		this.isReady = false;
		this.pendingFile = null;
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

		// Default place to send the file. A file is only ever sent to a named origin, never "*".
		this.targetOrigin = new URL(iframeUrl).origin;

		// Data-location sheets redirect to another host, so the iframe origin can differ from
		// targetOrigin. We use this domain to check the real origin before trusting it.
		this.baseDomain = customDomain || "app.csvbox.io";
		this.importerOrigin = null;

		const handleModalClosed = () => {
			if (this.holder.current) {
				this.holder.current.style.display = 'none';
				this.holder.current.style.pointerEvents = 'auto';
				this.holder.current.innerHTML = '';
			}
			this.lifecycle.markClosed();
			this.isModalShown = false;
			this.isReady = false;
			this.iframe = null;
			// A new iframe is built on the next open, so the origin is learned again.
			this.importerOrigin = null;
			this.probingOrigin = false;
			this.clearProbeTimer();
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

			// Set-file handshake messages. The shared core does not classify these, so they are
			// read here, behind the same unique_token check the core applies.
			const raw = event.data;
			if (raw && typeof raw === "object" && raw.data && raw.data.unique_token == this.uuid) {
				this.learnImporterOrigin(event);

				if (raw.type === "csvbox-set-file-rejected" && raw.data.reason === "not-a-file") {
					// Reply to our probe (it has no file). It only tells us the origin, so do nothing.
					return;
				}
				if (raw.type === "csvbox-modal-shown") {
					// What the file path in openModal() is waiting for. display as well as
					// pointer-events: a second file declined while the first was still opening the
					// modal has put the holder away in the meantime.
					this.isModalShown = true;
					this.lifecycle.requestOpen();
					if (this.holder.current) {
						this.holder.current.style.display = 'block';
						this.holder.current.style.pointerEvents = 'auto';
					}
					return;
				}
				if (raw.type === "csvbox-set-file-rejected") {
					// The importer has the file and will not take it. Put the holder away only if the
					// modal was never confirmed up: a file declined while it is open (an import past
					// the upload step, a fade-out under way) leaves that modal where it is, and its
					// own 'csvbox-modal-hidden' will put the holder away when it closes.
					if (!this.isModalShown && this.holder.current) {
						this.holder.current.style.display = 'none';
						this.holder.current.style.pointerEvents = 'auto';
					}
					console.warn("[csvbox] importer declined the supplied file: " + raw.data.reason);
					return;
				}
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
			this.isReady = true;
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

		if (this.pendingFile) {
			if (!this.isReady) {
				// Deferred: onload's markReady() calls openModal() again once the iframe is up.
				this.lifecycle.requestOpen();
				return;
			}
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
			return;
		}

		if (this.lifecycle.requestOpen()) {
			this.isModalShown = true;
			this.iframe.contentWindow.postMessage('openModal', '*');
			// Explicit: a previously declined file leaves the holder click-through.
			this.holder.current.style.pointerEvents = 'auto';
			this.holder.current.style.display = 'block';
		}
	}

	/**
	 * Open the importer on a File the host page already has, instead of the file picker.
	 *
	 * Reachable two ways: a ref on the component (`ref.current.openModalWithFile(file)`), or
	 * the third argument handed to the `render` prop.
	 *
	 * The File crosses to the iframe by structured clone, so the importer receives the real
	 * object and applies its own extension, worksheet and size rules to it -- this does not
	 * bypass any of them. Pass a File; a Blob has no name for the importer to read an
	 * extension from.
	 */
	openModalWithFile(file) {
		// window.File, not a bare File: eslint-config-standard declares only window, document
		// and navigator as browser globals, so a bare File is a no-undef error here.
		if (!window.File || !(file instanceof window.File)) {
			return;
		}

		this.pendingFile = file;

		// Already open: hand it over now rather than holding it for the next open. The importer
		// takes it only while it is still on the upload step, and ignores it once the user has a
		// dataset and a mapping in progress.
		if (this.isModalShown && this.iframe && this.isReady) {
			this.postPendingFile();
			return;
		}

		this.openModal();
	}

	postPendingFile() {
		if (this.importerOrigin) {
			this.sendPendingFile(this.importerOrigin);
			return;
		}

		// Origin not known yet: send a probe without the file, and send the file to the origin
		// that replies. If nobody replies in time, use targetOrigin like before.
		if (this.probingOrigin) {
			return;
		}
		this.probingOrigin = true;
		this.iframe.contentWindow.postMessage({
			type: 'csvbox-set-file',
			unique_token: this.uuid
		}, '*');
		this.probeTimer = setTimeout(() => {
			this.probeTimer = null;
			this.probingOrigin = false;
			this.sendPendingFile(this.targetOrigin);
		}, ORIGIN_PROBE_TIMEOUT_MS);
	}

	sendPendingFile(origin) {
		if (!this.pendingFile || !this.iframe) {
			return;
		}
		this.iframe.contentWindow.postMessage({
			type: 'csvbox-set-file',
			file: this.pendingFile,
			unique_token: this.uuid
		}, origin);
		this.pendingFile = null;
	}

	// Remember the importer's origin, only from our own iframe, with our token, and a csvbox host.
	learnImporterOrigin(event) {
		if (this.importerOrigin || !this.iframe || event.source !== this.iframe.contentWindow) {
			return;
		}
		if (!this.isImporterOrigin(event.origin)) {
			return;
		}
		this.importerOrigin = event.origin;
		if (this.probingOrigin) {
			this.probingOrigin = false;
			this.clearProbeTimer();
			this.sendPendingFile(this.importerOrigin);
		}
	}

	isImporterOrigin(origin) {
		let url;
		try {
			url = new URL(origin);
		} catch (e) {
			return false;
		}
		if (url.protocol !== 'https:') {
			return false;
		}
		return url.host === this.baseDomain || url.host.endsWith(`-${this.baseDomain}`);
	}

	clearProbeTimer() {
		if (this.probeTimer) {
			clearTimeout(this.probeTimer);
			this.probeTimer = null;
		}
	}

	componentWillUnmount() {
		this.clearProbeTimer();
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
					{this.props.render(this.openModal, this.state.isLoading, this.openModalWithFile)}
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
