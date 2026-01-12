// src/utils/responseHelper.js

class ResponseHelper {
  static success(res, data, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message, statusCode = 500, errors = null) {
    const response = {
      success: false,
      error: {
        message,
        code: statusCode
      },
      timestamp: new Date().toISOString()
    };

    if (errors) {
      response.error.details = errors;
    }

    return res.status(statusCode).json(response);
  }

  static stream(res, stream, contentType, contentLength, headers = {}) {
    res.setHeader('Content-Type', contentType);
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    stream.pipe(res);
  }
}

module.exports = ResponseHelper;