# Vibe ATV Off-road - Technical Context

## Technologies Used

### Core Libraries
- **Three.js (r134)**: 3D rendering engine that provides a high-level API for WebGL
- **Cannon.js (0.6.2)**: Physics engine for realistic simulation of movement and collisions
- **GLTFLoader**: Three.js module for loading 3D models in the GLTF format
- **FontLoader & TextGeometry**: For adding 3D text to the scene

### Frontend
- **HTML5**: Basic document structure
- **JavaScript (ES6+)**: Programming language for application logic
- **CSS3**: Minimal styling for canvas and page layout

### Assets
- **3D Models**: GLTF format for the ATV model
- **Textures**: Image files for terrain, skybox
- **Fonts**: For 3D text rendering of jump numbers and UI elements

## Development Setup
The application is designed to run directly in modern web browsers with WebGL support. No build process or transpilation is required, simplifying the development workflow.

### Local Development
1. Clone the repository
2. Serve the files using a local web server (e.g., Live Server for VS Code)
3. Access via http://localhost:port in a modern browser

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Technical Constraints

### Performance Considerations
- **Polygon Count**: The 3D models must maintain reasonable polygon counts for browser performance
- **Physics Complexity**: Physics calculations are CPU-intensive, requiring optimization
- **Texture Sizes**: Texture resolution must balance quality and loading performance
- **Animation Frame Rate**: Target 60fps for smooth gameplay

### Browser Limitations
- **WebGL Support**: Application requires WebGL 2.0 support
- **Memory Usage**: Browser memory limitations affect scene complexity
- **Mobile Performance**: Limited capabilities on mobile devices

### Cross-Browser Compatibility
- Vendor-specific differences in WebGL implementation
- Variations in JavaScript performance across browsers
- Input handling differences between desktop and mobile

## Dependencies

### External Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| Three.js | r134 | 3D rendering |
| Cannon.js | 0.6.2 | Physics simulation |
| GLTFLoader | Three.js module | 3D model loading |
| FontLoader | Three.js module | Font loading for 3D text |
| TextGeometry | Three.js module | 3D text creation |

### Asset Dependencies
- **ATV Model**: `models/atv/scene.gltf`
- **Desert Background**: `assets/desert_image.jpg`
- **Terrain Texture**: `textures/dirt.jpg`
- **Font**: Helvetiker (loaded from unpkg CDN)

## Deployment Strategy
The application is designed for simple static hosting:
1. Host files on any static web server (GitHub Pages, Netlify, etc.)
2. Ensure all assets are properly referenced
3. No server-side processing required
