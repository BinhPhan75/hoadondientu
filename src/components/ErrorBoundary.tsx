import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Bọc toàn bộ ứng dụng để một lỗi render bất ngờ ở BẤT KỲ component con nào
 * (ví dụ: modal xem chi tiết hóa đơn nhận dữ liệu bất thường sau khi đã đóng)
 * không làm sập toàn bộ cây React thành TRANG TRẮNG buộc người dùng phải tải
 * lại trang. Thay vào đó hiển thị màn hình khôi phục kèm nút "Thử lại".
 *
 * Lưu ý: đây là lưới an toàn (safety net), không thay thế việc sửa tận gốc
 * nguyên nhân gây lỗi trong từng component.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Lỗi render không mong muốn:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            textAlign: 'center',
            fontFamily: 'inherit'
          }}
        >
          <h2 style={{ margin: 0, color: '#b91c1c' }}>Đã xảy ra lỗi hiển thị</h2>
          <p style={{ maxWidth: 480, color: '#4b5563', margin: 0 }}>
            Một phần giao diện gặp lỗi bất ngờ (thường do dữ liệu hóa đơn không đúng định dạng).
            Bạn có thể thử lại mà không mất dữ liệu đã tải, hoặc tải lại toàn bộ trang nếu vẫn còn lỗi.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                maxWidth: 640,
                overflow: 'auto',
                background: '#f3f4f6',
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                color: '#6b7280',
                textAlign: 'left'
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#fff',
                color: '#374151',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
