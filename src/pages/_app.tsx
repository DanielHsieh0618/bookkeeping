import Layout from '../components/layout'

 
export default function MyApp({ Component, pageProps }: { Component: any, pageProps: any }) {
    return (
        <Layout>
            <Component {...pageProps} />
        </Layout>
    )
}