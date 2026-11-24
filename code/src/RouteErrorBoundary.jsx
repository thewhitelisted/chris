import { Component } from 'react'
import { describeError } from './describeError.js'

class RouteErrorBoundary extends Component {
  state = { hasError: false, error: undefined, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey
      ? null
      : { hasError: false, error: undefined, resetKey: props.resetKey }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="content-page">
          <p className="post-paragraph" role="alert">Could not load this page ({describeError(this.state.error)}).</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default RouteErrorBoundary
