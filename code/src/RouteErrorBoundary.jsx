import { Component } from 'react'

class RouteErrorBoundary extends Component {
  state = { hasError: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  static getDerivedStateFromProps(props, state) {
    return props.resetKey === state.resetKey ? null : { hasError: false, resetKey: props.resetKey }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="content-page">
          <p className="post-paragraph" role="alert">This page failed to load. Reload to try again.</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default RouteErrorBoundary
