 tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        purple: {
                            900: '#1e0b36',
                            800: '#2d1060',
                            700: '#3d1d8a',
                            600: '#5e35b1',
                            500: '#7e57c2',
                        },
                        dark: {
                            950: '#0a0a0a',
                            900: '#121212',
                            850: '#1a1a1a',
                            800: '#242424',
                        }
                    },
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    boxShadow: {
                        'soft': '0 4px 24px 0 rgba(0,0,0,0.12)',
                        'purple-glow': '0 4px 24px 0 rgba(124, 58, 237, 0.2)'
                    }
                }
            }
        }