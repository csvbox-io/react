import React, { PropsWithChildren } from 'react';
declare module '@csvbox/react' {
    interface CSVBoxImporterProps {
        lazy?: boolean;
        loadStarted?:() => void;
        user: any;
        dynamicColumns?: any;
        options?: any;
        onReady?:() => void;
        onImport:(type:boolean, metadata?:any) => void;
        onSubmit?:(metadata:any) => void;
        onClose?:() => void;
        licenseKey: string;
        dataLocation?: string;
        customDomain?: string;
        language?: string;
        environment?: any;
        theme?: string;
        render?:(launch:any, isLoading:boolean, launchWithFile:(file:File) => void) => void
    }

    export class CSVBoxButton extends React.Component<PropsWithChildren<CSVBoxImporterProps>>{
        constructor(props: CSVBoxImporterProps);

        holder: React.RefObject<HTMLDivElement>;
        uuid: string;
        iframe: HTMLIFrameElement | null;
        isModalShown: boolean;
        isReady: boolean;
        pendingFile: File | null;
        targetOrigin?: string;
        baseDomain?: string;

        openModal(): void;

        openModalWithFile(file: File): void;

        componentDidMount(): void;

        initImporter(): void;

        enableInitiator(): void;
    }
}
