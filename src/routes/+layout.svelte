<script lang="ts">
	import '../app.css';
	import { MetaTags } from 'svelte-meta-tags';

	let { children } = $props();

	const SITE_URL = 'https://youlo.se';
	const TITLE = 'THE HOUSE ALWAYS WINS';
	const DESCRIPTION =
		'The math behind why gambling is stupid. Every game, every strategy, every time: you lose. Here\u2019s the proof.';
</script>

<MetaTags
	title={TITLE}
	description={DESCRIPTION}
	canonical={SITE_URL}
	keywords={['gambling', 'house edge', 'casino math', 'expected value', 'probability', 'why gambling is bad', 'gambling simulator', 'anti-gambling']}
	additionalRobotsProps={{
		maxSnippet: -1,
		maxImagePreview: 'large',
		maxVideoPreview: -1,
	}}
	openGraph={{
		type: 'website',
		url: SITE_URL,
		title: TITLE,
		description: DESCRIPTION,
		siteName: 'youlo.se',
		locale: 'en_US',
		images: [
			{
				url: `${SITE_URL}/og-banner.png`,
				width: 1200,
				height: 630,
				alt: 'THE HOUSE ALWAYS WINS. Every gambler thinks they\u2019re the exception. None of them are.',
				type: 'image/png',
			},
		],
	}}
	twitter={{
		cardType: 'summary_large_image',
		title: TITLE,
		description: DESCRIPTION,
		image: `${SITE_URL}/og-banner.png`,
		imageAlt: 'THE HOUSE ALWAYS WINS. The math behind why gambling is stupid.',
	}}
	additionalLinkTags={[
		{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
		{ rel: 'icon', href: '/favicon.png', type: 'image/png', sizes: '192x192' },
		{ rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
	]}
/>

{@render children()}
