import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    textAlign: 'center',
                    backgroundColor: '#000',
                    color: '#fff',
                    fontFamily: 'sans-serif'
                }}>
                    <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Ops! Algo deu errado.</h1>
                    <p style={{ color: '#aaa', marginBottom: '24px', maxWidth: '400px' }}>
                        Ocorreu um erro inesperado no sistema. Por favor, tente recarregar a página.
                    </p>

                    <button
                        onClick={this.handleReload}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: '#fff',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        Recarregar Sistema
                    </button>

                    {import.meta.env.MODE === 'development' && this.state.error && (
                        <pre style={{
                            marginTop: '40px',
                            padding: '16px',
                            backgroundColor: '#111',
                            color: '#f44',
                            borderRadius: '8px',
                            fontSize: '12px',
                            textAlign: 'left',
                            overflow: 'auto',
                            maxWidth: '90vw'
                        }}>
                            {this.state.error.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
