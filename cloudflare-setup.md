# Cloudflare Setup Guide for Vibe ATV Off-road

This guide explains how to set up Cloudflare to handle HTTPS encryption for your Vibe ATV Off-road multiplayer game.

## Benefits of Using Cloudflare

- **Automatic SSL/TLS Encryption**: No need to manage certificates
- **DDoS Protection**: Built-in protection against attacks
- **Content Delivery Network**: Faster loading for static assets
- **Traffic Analytics**: Insights about your players' connections

## Setup Steps

### 1. Register for a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up for an account
2. Verify your email address

### 2. Add Your Domain to Cloudflare

1. On the Cloudflare dashboard, click "Add a Site"
2. Enter your domain name and click "Add Site"
3. Select a plan (the Free plan is sufficient for most game hosting needs)
4. Cloudflare will scan your existing DNS records

### 3. Update Your Nameservers

1. Cloudflare will provide you with nameservers to use
2. Log in to your domain registrar (where you purchased your domain)
3. Replace the existing nameservers with Cloudflare's nameservers
4. This process may take 24-48 hours to complete

### 4. Configure DNS Records

1. Create an A record pointing to your server's IP address:
   - Type: A
   - Name: @ (or subdomain, e.g., "game")
   - IPv4 address: Your server's IP address
   - Proxy status: Proxied (orange cloud icon)

### 5. Configure Cloudflare Settings

#### SSL/TLS Settings

1. Go to the SSL/TLS tab
2. Set the SSL/TLS encryption mode to "Flexible" (recommended)
   - "Flexible" doesn't require HTTPS on your origin server but is less secure

3. Under Edge Certificates, enable:
   - Always Use HTTPS
   - Automatic HTTPS Rewrites

#### Network Settings

1. Go to the Network tab
2. Under WebSockets, ensure it's set to "On" (WebSockets are enabled by default)
3. Set HTTP/2 to "On"
4. Set HTTP/3 (QUIC) to "On"

#### Cache Settings

1. Go to the Caching tab and under the Configuration section:
   - Set the Browser Cache TTL to a lower value (e.g., 30 minutes) for dynamic game content
   
2. Create a Page Rule for WebSocket traffic:
   - URL pattern: `*yourdomain.com/socket.io/*`
   - Setting: "Cache Level"
   - Value: "Bypass"

3. Create another Page Rule for your API endpoints (if any):
   - URL pattern: `*yourdomain.com/api/*`
   - Setting: "Cache Level"
   - Value: "Bypass"

### 6. Network Settings

1. Go to the Network tab
2. Enable WebSockets
3. Set the HTTP/2 to "On"
4. Set the HTTP/3 (QUIC) to "On"

## Testing Your Setup

1. Deploy your application with the updated code
2. Visit your domain with HTTPS: `https://yourdomain.com`
3. Check browser console for WebSocket connection issues
4. Test multiplayer functionality with multiple browsers

## Troubleshooting

### WebSocket Connection Issues

If players are having trouble connecting:

1. Verify WebSockets are enabled in Cloudflare
2. Check your Page Rules for socket.io paths
3. Ensure your server is accepting WebSocket connections

### Mixed Content Warnings

If you see mixed content warnings:

1. Make sure all assets are loaded via HTTPS
2. Check for hardcoded HTTP URLs in your code
3. Enable Automatic HTTPS Rewrites in Cloudflare

## Cloudflare SSL Modes Explained

### Flexible SSL (Recommended for Vibe ATV Off-road)

- Cloudflare ↔ Visitors: HTTPS
- Cloudflare ↔ Origin: HTTP
- **Key Benefit**: No certificates needed on your origin server
- **Configuration**: Empty `SSL_KEY_PATH` and `SSL_CERT_PATH` in docker-compose.yml
- **Best For**: Simplest setup with good security for most multiplayer games

This is the recommended setup for Vibe ATV Off-road as it provides:
- Encrypted connections for players
- Simplest configuration (no certificate management)
- Works immediately with your existing Docker setup

### Full SSL

- Cloudflare ↔ Visitors: HTTPS
- Cloudflare ↔ Origin: HTTPS
- Origin needs SSL certificate (can be self-signed)
- Requires certificate files in your server
- Good balance of security and ease of setup

### Full (Strict) SSL

- Cloudflare ↔ Visitors: HTTPS
- Cloudflare ↔ Origin: HTTPS with valid certificate
- Most secure option
- Requires valid certificate on origin server
- Recommended only for applications handling sensitive data

## Recommended Setup: Flexible SSL

We've configured your application to work best with Cloudflare's Flexible SSL mode:

1. No local certificates required
2. Docker environment configured with empty SSL paths
3. Server code updated to handle this configuration

This approach ensures your multiplayer game remains fast and responsive while still protecting player connections with HTTPS. All the game's unique features (extreme tilting physics, colorful ramps) will work seamlessly through Cloudflare's proxy.
