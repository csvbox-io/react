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
        render?:(launch:any, isLoading:boolean) => void
    }

    export class CSVBoxButton extends React.Component<PropsWithChildren<CSVBoxImporterProps>>{
        constructor(props: CSVBoxImporterProps);

        holder: React.RefObject<HTMLDivElement>;
        isModalShown: boolean;
        shouldOpenModalOnReady: boolean;
        uuid: string;
        iframe: HTMLIFrameElement | null;

        openModal(): void;

        generateUuid(): string;

        componentDidMount(): void;

        initImporter(): void;

        enableInitator(): void;
    }
}
