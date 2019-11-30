// /*
// ** TailwindCSS Configuration File
// **
// ** Docs: https://tailwindcss.com/docs/configuration
// ** Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
// */
// module.exports = {
//   theme: {},
//   variants: {},
//   plugins: []
// }

module.exports = {
  theme: {
    // colors: {
    //   gray: {
    //     100: '#f7fafc',
    //     200: '#edf2f7',
    //     300: '#e2e8f0',
    //     400: '#cbd5e0',
    //     500: '#a0aec0',
    //     600: '#718096',
    //     700: '#4a5568',
    //     800: '#2d3748',
    //     900: '#1a202c'
    //   }
    // },
    extend: {

      fontFamily: {
        sans: [
          'Avenir',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans"',
          'sans-serif',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          '"Segoe UI Symbol"',
          '"Noto Color Emoji"'
        ]
      },
      spacing: {
        px: '1px',
        '0': '0',
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '5': '1.25rem',
        '6': '1.5rem',
        '8': '2rem',
        '10': '2.5rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '40': '10rem',
        '48': '12rem',
        '56': '14rem',
        '64': '16rem',
        xs: '20rem',
        sm: '24rem',
        md: '28rem',
        lg: '32rem',
        xl: '36rem',
        '2xl': '42rem',
        '3xl': '48rem',
        '4xl': '56rem',
        '5xl': '64rem',
        '6xl': '72rem',
        full: '100%'
      }
    }
  },
  variants: {
  },
  plugins: []
}
