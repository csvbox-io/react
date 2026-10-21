import React, { Component } from 'react';
import { version } from '../package.json';
import {
	HOLDER_STYLE,
	IFRAME_STYLE,
	buildImportUrl,
	generateUuid,
	buildInitPayload,
	createModalLifecycle,
	createFileSender,
	classifyStructuredMessage,
	classifyLegacyMessage
} from '@csvbox/adapter';

// How long we wait for the importer to confirm a file it was sent before giving up on it.
const FILE_ACK_TIMEOUT_MS = 8000;

// Page-wide record of the importers that are open or opening, shared by every CSVBox adapter
// on the page (it lives on window so separate copies of an adapter see the same list). It does
// two things: the newest importer is stacked on top (every holder is fixed, full screen and
// z-index 2147483647, so equal z-indexes would leave the one that comes first in the DOM on
// top), and the other instances learn that an importer is open so they can disable their button.
const OPEN_IMPORTERS_KEY = '__csvboxOpenImporters';
const TOP_Z_INDEX = 2147483647;

function openImporters() {
	if (!window[OPEN_IMPORTERS_KEY]) window[OPEN_IMPORTERS_KEY] = { open: [], listeners: [] };
	return window[OPEN_IMPORTERS_KEY];
}

function restackOpenImporters(reg) {
	reg.open.forEach(function (entry, i) {
		const holder = entry.getHolder();
		if (holder) holder.style.zIndex = String(TOP_Z_INDEX - (reg.open.length - 1 - i));
	});
}

function registerOpenImporter(entry) {
	const reg = openImporters();
	if (reg.open.indexOf(entry) >= 0) return;
	reg.open.push(entry);
	restackOpenImporters(reg);
	reg.listeners.slice().forEach(function (fn) { fn(); });
}

function unregisterOpenImporter(entry) {
	const reg = openImporters();
	const i = reg.open.indexOf(entry);
	if (i < 0) return;
	reg.open.splice(i, 1);
	restackOpenImporters(reg);
	reg.listeners.slice().forEach(function (fn) { fn(); });
}

function isBlockedByOpenImporter(entry) {
	const reg = openImporters();
	return reg.open.length > 0 && reg.open.indexOf(entry) < 0;
}

function subscribeOpenImporters(fn) {
	const reg = openImporters();
	reg.listeners.push(fn);
	return function () {
		const i = reg.listeners.indexOf(fn);
		if (i >= 0) reg.listeners.splice(i, 1);
	};
}

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
			isLoading: true,
			// True while a different importer on the page is open: the button stays disabled.
			blocked: false
		};
		this.iframe = null;
		this.registryEntry = { getHolder: () => this.holder.current };
		this.fileSender = createFileSender({
			getIframe: () => this.iframe,
			getToken: () => this.uuid,
			getTargetOrigin: () => this.targetOrigin,
			getBaseDomain: () => this.baseDomain,
			takeFile: () => {
				const file = this.pendingFile;
				this.pendingFile = null;
				return file;
			},
			onSent: () => this.startFileAckTimer()
		});
	}

	componentDidMount() {
		this.syncBlocked();
		this.unsubscribeOpenImporters = subscribeOpenImporters(() => this.syncBlocked());
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
		this.fileSender.reset();

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
			this.clearProbeTimer();
			unregisterOpenImporter(this.registryEntry);
			onClose?.();
		};

		if (this.messageListener) {
			window.removeEventListener("message", this.messageListener, false);
		}

		this.messageListener = (event) => {
			const legacy = classifyLegacyMessage(event.data);
			if (legacy) {
				// Legacy messages carry no token, so the only way to tell which importer sent one is
				// its window. Ignore those that came from another instance's iframe (or anywhere else).
				if (!this.iframe || event.source !== this.iframe.contentWindow) {
					return;
				}
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
				this.fileSender.learnOrigin(event);

				if (raw.type === "csvbox-set-file-rejected" && raw.data.reason === "not-a-file") {
					// Reply to our probe (it has no file). It only tells us the origin, so do nothing.
					return;
				}
				if (raw.type === "csvbox-modal-shown") {
					this.clearFileAckTimer();
					registerOpenImporter(this.registryEntry);
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
					this.clearFileAckTimer();
					// The importer has the file and will not take it. Put the holder away only if the
					// modal was never confirmed up: a file declined while it is open (an import past
					// the upload step, a fade-out under way) leaves that modal where it is, and its
					// own 'csvbox-modal-hidden' will put the holder away when it closes.
					if (!this.isModalShown && this.holder.current) {
						this.holder.current.style.display = 'none';
						this.holder.current.style.pointerEvents = 'auto';
						unregisterOpenImporter(this.registryEntry);
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
		// Counts as open from the moment it is requested, so the other buttons are disabled while
		// this importer is still loading, and so it is stacked above any importer opened earlier.
		registerOpenImporter(this.registryEntry);
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
			this.fileSender.send();
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
			this.fileSender.send();
			return;
		}

		this.openModal();
	}

	clearProbeTimer() {
		this.clearFileAckTimer();
		this.fileSender.reset();
	}

	startFileAckTimer() {
		this.clearFileAckTimer();
		this.fileAckTimer = setTimeout(() => {
			this.fileAckTimer = null;
			this.giveUpOnFile();
		}, FILE_ACK_TIMEOUT_MS);
	}

	clearFileAckTimer() {
		if (this.fileAckTimer) {
			clearTimeout(this.fileAckTimer);
			this.fileAckTimer = null;
		}
	}

	// The importer never confirmed the file it was sent (an origin we do not trust, or an importer too
	// old to know the message). Without this the holder would stay up, invisible and click-through,
	// and the other instances' buttons would stay disabled for good.
	giveUpOnFile() {
		if (this.isModalShown) {
			return;
		}
		const holder = this.holder.current;
		if (holder) {
			holder.style.display = 'none';
			holder.style.pointerEvents = 'auto';
		}
		unregisterOpenImporter(this.registryEntry);
		console.warn("[csvbox] the importer did not respond to the supplied file");
	}

	componentWillUnmount() {
		this.clearProbeTimer();
		unregisterOpenImporter(this.registryEntry);
		if (this.unsubscribeOpenImporters) {
			this.unsubscribeOpenImporters();
			this.unsubscribeOpenImporters = null;
		}
		if (this.messageListener) {
			window.removeEventListener("message", this.messageListener, false);
			this.messageListener = null;
		}
	}

	syncBlocked() {
		const blocked = isBlockedByOpenImporter(this.registryEntry);
		if (blocked !== this.state.blocked) {
			this.setState({ blocked });
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
					{this.props.render(this.openModal, this.state.isLoading || this.state.blocked, this.openModalWithFile)}
					<div ref={this.holder} style={HOLDER_STYLE}></div>
				</div>
			)
		}

		return (
			<div>
				<button disabled={this.state.isLoading || this.state.blocked} onClick={this.openModal} data-csvbox-initator data-csvbox-token={this.uuid}>{this.props.children}</button>
				<div ref={this.holder} style={HOLDER_STYLE}></div>
			</div>
		)
	}
}

export default CSVBoxButton;
