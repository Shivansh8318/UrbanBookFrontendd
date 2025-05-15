# UrbanBookk

A React Native mobile application for urban booking services.

## Project Overview

UrbanBookk is built with React Native and includes features like:
- User authentication with OTPless
- Navigation using React Navigation
- Beautiful UI components with Gesture Handler and Linear Gradient

## Installation Requirements

- Node.js >= 18
- npm or Yarn
- For iOS: Xcode, CocoaPods
- For Android: Android Studio, JDK, Android SDK

## Installation Guide

### 1. Clone the repository

```sh
git clone https://github.com/yourusername/UrbanBook6.git
cd UrbanBook6/UrbanBookk
```

### 2. Install dependencies

```sh
# Using npm
npm install

# OR using Yarn
yarn install
```

### 3. iOS Setup (macOS only)

Install CocoaPods if you haven't already:

```sh
sudo gem install cocoapods
```

Install the project's CocoaPods dependencies:

```sh
cd ios
bundle install
bundle exec pod install
cd ..
```

### 4. Starting the Development Server

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

### 5. Running the App

#### For Android:

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

#### For iOS (macOS only):

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

## Development

### Making Changes

Open `App.tsx` in your text editor of choice and make changes. When you save, your app will automatically update using Fast Refresh.

To forcefully reload the app:
- **Android**: Press <kbd>R</kbd> key twice or select "Reload" from the Dev Menu (<kbd>Ctrl</kbd> + <kbd>M</kbd> or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd>)
- **iOS**: Press <kbd>R</kbd> in iOS Simulator

## Troubleshooting

If you encounter any issues during setup or running the app:

1. Make sure you have all the prerequisites installed correctly
2. Check that you're using Node.js version 18 or higher
3. For iOS issues, try reinstalling pods: `cd ios && pod install`
4. For Android, verify that your environment variables (ANDROID_HOME, etc.) are set correctly
5. Refer to the [React Native Troubleshooting](https://reactnative.dev/docs/troubleshooting) guide

## Learn More

To learn more about React Native, check out:
- [React Native Website](https://reactnative.dev)
- [Getting Started](https://reactnative.dev/docs/environment-setup)
- [Learn the Basics](https://reactnative.dev/docs/getting-started)

## License

[MIT License](LICENSE)
