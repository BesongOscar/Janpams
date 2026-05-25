lint: 
	npx eslint .

fix-lint: 
	npx eslint . --fix

test: 
	yarn test -u

run: 
	yarn start

run-android:
	yarn start --android

run-ios: 
	yarn start --ios

install:
	yarn install

build-and-test-android: 
	eas build --profile build-and-maestro-test --platform android $(FLAGS)

push: 
	git push origin $(BRANCH) && git push upstream $(BRANCH)

dev-build:
	eas build --profile development --platform $(PLATFORM) $(FLAGS)