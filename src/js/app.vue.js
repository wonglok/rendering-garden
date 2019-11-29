import Vue from 'vue'

var newVue = new Vue({
  el: '#app',
  render: h => h(require('../vue/App.vue').default),
  data () {
    return {
      dat: 123
    }
  }
})